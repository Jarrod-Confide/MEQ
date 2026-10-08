import { unstable_cache } from "next/cache";
import { meqSql } from "./db/meq";
import { DIMENSION_WEIGHTS, type Dimension } from "./engagement";
import { safeIso } from "./safe-date";
import { TERRITORIES, type Territory } from "./territory";
import { getJoinedMembers } from "./new-members-data";
import { getEngagementShareTrend } from "./goals-data";

/**
 * Weekly engagement trend for the membership overview's explorer: one
 * MEQ-only query over member_engagement_snapshots (members only), shaped by
 * the chosen measure, region and span. Cached 10 minutes per combination.
 */

export const TREND_METRICS = [
  { key: "avg", label: "Average score", note: "members with any activity" },
  { key: "avgAll", label: "Average score, everyone", note: "inactive members count as 0" },
  { key: "median", label: "Median score", note: "members with any activity" },
  { key: "active", label: "Members with any activity", note: "count" },
  { key: "activePlus", label: "Champion + Active", note: "count" },
  { key: "participating", label: "% participating", note: "the engagement goal's measure" },
] as const;
export type TrendMetric = (typeof TREND_METRICS)[number]["key"] | `dim:${Dimension}`;

export const DIMENSIONS = Object.keys(DIMENSION_WEIGHTS) as Dimension[];

export const TREND_SPANS = [
  { key: "12", label: "12 weeks" },
  { key: "26", label: "6 months" },
  { key: "52", label: "1 year" },
  { key: "all", label: "All" },
] as const;

export function parseMetric(s: string | undefined): TrendMetric {
  if (s?.startsWith("dim:") && DIMENSIONS.includes(s.slice(4) as Dimension)) return s as TrendMetric;
  return TREND_METRICS.some((m) => m.key === s) ? (s as TrendMetric) : "avg";
}

export function metricLabel(m: TrendMetric): string {
  if (m.startsWith("dim:")) {
    const d = m.slice(4);
    return `Average ${d[0].toUpperCase()}${d.slice(1)} (0 to 100)`;
  }
  return TREND_METRICS.find((x) => x.key === m)!.label;
}

type WeekRow = { week: string; n: number; avg: number; median: number; activePlus: number; sum: number; dim: number | null };

const weeklyRows = (regions: string, dim: string) =>
  unstable_cache(
    async (): Promise<WeekRow[]> => {
      const list = regions === "ALL" ? [...TERRITORIES] : regions.split(",");
      const rows = await meqSql<
        { week_start: Date; n: number; avg: number; median: number; active_plus: number; sum: number; dim: number | null }[]
      >`
        SELECT week_start,
               COUNT(*)::int AS n,
               AVG(total)::float AS avg,
               percentile_cont(0.5) WITHIN GROUP (ORDER BY total)::float AS median,
               COUNT(*) FILTER (WHERE tier IN ('Champion', 'Active'))::int AS active_plus,
               SUM(total)::float AS sum,
               AVG(NULLIF(dimensions->>${dim}, '')::float)::float AS dim
        FROM member_engagement_snapshots
        WHERE is_member AND member_id IS NOT NULL AND territory = ANY(${list})
        GROUP BY week_start ORDER BY week_start`;
      return rows.map((r) => ({
        week: (safeIso(r.week_start) ?? "").slice(0, 10),
        n: r.n,
        avg: r.avg ?? 0,
        median: r.median ?? 0,
        activePlus: r.active_plus,
        sum: r.sum ?? 0,
        dim: r.dim,
      }));
    },
    ["engagement-trend-v1", regions, dim],
    { revalidate: 600, tags: ["snapshots"] }
  )();

export async function getEngagementTrend(
  metric: TrendMetric,
  regions: Territory[] | "ALL",
  span: string
): Promise<{ week: string; value: number }[]> {
  const weeksBack = span === "all" ? Infinity : Number(span) || 26;
  const keep = <T extends { week: string }>(xs: T[]) => (Number.isFinite(weeksBack) ? xs.slice(-weeksBack) : xs);

  if (metric === "participating") {
    return keep(await getEngagementShareTrend(regions)).map((p) => ({ week: p.week, value: p.pct }));
  }
  const regionKey = regions === "ALL" ? "ALL" : [...regions].sort().join(",");
  const dim = metric.startsWith("dim:") ? metric.slice(4) : "events";
  const rows = keep(await weeklyRows(regionKey, dim));
  if (metric === "avgAll") {
    const roster = await getJoinedMembers();
    return rows.map((r) => {
      const end = new Date(r.week).getTime() + 7 * 86400000;
      const members = roster.filter(
        (m) => (regions === "ALL" || regions.includes(m.region)) && new Date(m.joinedAt).getTime() < end
      ).length;
      return { week: r.week, value: members ? Math.round((r.sum / members) * 10) / 10 : 0 };
    });
  }
  const pick: Record<string, (r: WeekRow) => number> = {
    avg: (r) => r.avg,
    median: (r) => r.median,
    active: (r) => r.n,
    activePlus: (r) => r.activePlus,
  };
  const f = pick[metric] ?? ((r: WeekRow) => r.dim ?? 0);
  return rows.map((r) => ({ week: r.week, value: Math.round(f(r) * 10) / 10 }));
}

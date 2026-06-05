import { meqSql } from "./db/meq";
import { eventflowSql } from "./db";
import { getEngagement } from "./engagement-cache";
import { TIERS } from "./engagement";
import { QUALITY_TIER_ORDER } from "./quality-tiers";

export type DashboardData = {
  totalMembers: number;
  newIn7d: number;
  newIn30d: number;
  newIn90d: number;
  priorIn30d: number;
  trend30dPct: number | null; // % change vs prior 30d
  monthlyJoins: { month: string; count: number }[];
  qualityTierCounts: Record<string, number>;
  engagementTierCounts: Record<string, number>;
  activeIn30d: number;
  topMetros: { name: string; count: number }[];
  topCompanies: { name: string; count: number }[];
  fortune2000Count: number;
  vCISOCount: number;
  largeCompanyCount: number;
  cLevelCount: number;
  reportsToCeoCount: number;
  eventAttendees30d: number;
  engagementTrend: { week: string; scored: number; activePlus: number; avgTotal: number }[];
  syncedAt: string | null;
};

export async function fetchDashboard(): Promise<DashboardData> {
  const [
    counts,
    monthly,
    qualityTiers,
    metros,
    companies,
    composition,
    eventAttendees,
    trend,
    eng90,
    eng30,
  ] = await Promise.all([
    meqSql<
      {
        total: number;
        new_7d: number;
        new_30d: number;
        new_90d: number;
        prior_30d: number;
        synced_at: Date | null;
      }[]
    >`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE joined_at >= NOW() - INTERVAL '7 days')::int AS new_7d,
        COUNT(*) FILTER (WHERE joined_at >= NOW() - INTERVAL '30 days')::int AS new_30d,
        COUNT(*) FILTER (WHERE joined_at >= NOW() - INTERVAL '90 days')::int AS new_90d,
        COUNT(*) FILTER (
          WHERE joined_at >= NOW() - INTERVAL '60 days'
            AND joined_at <  NOW() - INTERVAL '30 days'
        )::int AS prior_30d,
        MAX(last_synced_at) AS synced_at
      FROM members
    `,
    meqSql<{ month: string; count: number }[]>`
      SELECT to_char(date_trunc('month', joined_at), 'YYYY-MM') AS month,
             COUNT(*)::int AS count
      FROM members
      WHERE joined_at >= date_trunc('month', NOW() - INTERVAL '11 months')
      GROUP BY 1 ORDER BY 1 ASC
    `,
    meqSql<{ tier: string; n: number }[]>`
      SELECT COALESCE(quality_tier, 'Unranked') AS tier, COUNT(*)::int AS n
      FROM member_quality GROUP BY 1
    `,
    meqSql<{ name: string; count: number }[]>`
      SELECT closest_major_city AS name, COUNT(*)::int AS count
      FROM members
      WHERE closest_major_city IS NOT NULL AND closest_major_city <> ''
      GROUP BY 1 ORDER BY count DESC LIMIT 5
    `,
    meqSql<{ name: string; count: number }[]>`
      SELECT company AS name, COUNT(*)::int AS count
      FROM member_quality
      WHERE company IS NOT NULL AND company <> ''
      GROUP BY 1 ORDER BY count DESC LIMIT 5
    `,
    meqSql<
      {
        f2000: number;
        vciso: number;
        large_co: number;
        c_level: number;
        ceo: number;
      }[]
    >`
      SELECT
        COUNT(*) FILTER (WHERE is_fortune_2000)::int AS f2000,
        COUNT(*) FILTER (WHERE employment_type = 'self_employed')::int AS vciso,
        COUNT(*) FILTER (WHERE company_size IN ('1,001-5,000','5,001-10,000','10,000+'))::int AS large_co,
        COUNT(*) FILTER (WHERE seniority = 'C-Level')::int AS c_level,
        COUNT(*) FILTER (WHERE reporting_to IN ('CEO','Board'))::int AS ceo
      FROM member_quality
    `,
    eventflowSql<{ n: number }[]>`
      SELECT COUNT(DISTINCT a.contact_id)::int AS n
      FROM attendees a JOIN events e ON a.event_id = e.id
      WHERE a.status = 'attended' AND e.starts_at >= NOW() - INTERVAL '30 days'
    `,
    meqSql<{ week_start: Date; scored: number; active_plus: number; avg_total: number }[]>`
      SELECT week_start,
             COUNT(*)::int scored,
             COUNT(*) FILTER (WHERE tier IN ('Champion','Active'))::int active_plus,
             ROUND(AVG(total)::numeric, 1)::float avg_total
      FROM member_engagement_snapshots
      GROUP BY week_start ORDER BY week_start
    `,
    getEngagement(90),
    getEngagement(30),
  ]);

  const c = counts[0];

  const engagementTrend = trend.map((r) => ({
    week: new Date(r.week_start).toISOString().slice(0, 10),
    scored: r.scored,
    activePlus: r.active_plus,
    avgTotal: r.avg_total ?? 0,
  }));

  // Fill a complete 12-month series (zero-fill empty months).
  const monthlyJoins: { month: string; count: number }[] = [];
  const byMonth = new Map(monthly.map((m) => [m.month, m.count]));
  for (let i = 11; i >= 0; i--) {
    const d = new Date();
    d.setUTCDate(1);
    d.setUTCMonth(d.getUTCMonth() - i);
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    monthlyJoins.push({ month: key, count: byMonth.get(key) ?? 0 });
  }

  const qualityTierCounts: Record<string, number> = {};
  for (const t of QUALITY_TIER_ORDER) qualityTierCounts[t] = 0;
  for (const r of qualityTiers) qualityTierCounts[r.tier] = r.n;

  const engagementTierCounts: Record<string, number> = {};
  for (const t of TIERS) engagementTierCounts[t] = eng90.tierCounts[t] ?? 0;

  const trend30dPct =
    c.prior_30d > 0
      ? Math.round(((c.new_30d - c.prior_30d) / c.prior_30d) * 100)
      : c.new_30d > 0
        ? 100
        : null;

  return {
    totalMembers: c.total,
    newIn7d: c.new_7d,
    newIn30d: c.new_30d,
    newIn90d: c.new_90d,
    priorIn30d: c.prior_30d,
    trend30dPct,
    monthlyJoins,
    qualityTierCounts,
    engagementTierCounts,
    activeIn30d: eng30.scoredCount,
    topMetros: metros,
    topCompanies: companies,
    fortune2000Count: composition[0].f2000,
    vCISOCount: composition[0].vciso,
    largeCompanyCount: composition[0].large_co,
    cLevelCount: composition[0].c_level,
    reportsToCeoCount: composition[0].ceo,
    eventAttendees30d: eventAttendees[0].n,
    engagementTrend,
    syncedAt: c.synced_at ? new Date(c.synced_at).toISOString() : null,
  };
}

import { unstable_cache } from "next/cache";
import { eq, isNotNull } from "drizzle-orm";
import { meqDb, meqSql, schema } from "./db/meq";
import { getFullLeaderboard } from "./leaderboard";
import { CITY_GEO } from "./cities";
import { territoryFromCity, TERRITORIES, type Territory } from "./territory";

/**
 * Live region rollups for the CM Regions dashboard. Buckets the FULL
 * engagement leaderboard (active + dormant) into the state-based CM regions
 * and computes per-region aggregates + a ranked member list for drill-in.
 * Reads live — no dependency on the weekly snapshot's stored region, so it's
 * correct the moment region definitions change.
 */

export type TierName = "Champion" | "Active" | "Engaged" | "Light" | "Dormant";
const TIER_NAMES: TierName[] = ["Champion", "Active", "Engaged", "Light", "Dormant"];

export type RegionMember = {
  key: string;
  name: string;
  total: number; // engagement 0–100
  tier: string;
  qualityScore: number | null;
  qualityTier: string | null;
  company: string | null;
  email: string | null;
  city: string | null;
};

export type RegionSummary = {
  region: Territory;
  members: number;
  scored: number; // engagement > 0
  avgEngagement: number; // mean over ALL members (per-capita) — the headline
  avgActive: number; // mean over scored members only
  medianEngagement: number;
  engagedRate: number; // % Active+ (0–100)
  champions: number; // Champion + Active
  dormant: number;
  avgQuality: number | null;
  highQuality: number; // Platinum + Gold
  tierCounts: Record<TierName, number>;
};

export type RegionsData = {
  computedAt: string;
  days: number;
  totalMembers: number;
  summaries: RegionSummary[]; // in TERRITORY_ORDER
  membersByRegion: Record<Territory, RegionMember[]>; // each sorted desc by total
};

const ACTIVE_PLUS = new Set(["Champion", "Active"]);
const HIGH_Q = new Set(["Platinum", "Gold"]);

async function fetchRegions(days: number): Promise<RegionsData> {
  const [board, roster] = await Promise.all([
    getFullLeaderboard(days),
    meqDb
      .select({
        ef: schema.members.eventflowContactId,
        city: schema.members.closestMajorCity,
        email: schema.members.email,
        company: schema.memberQuality.company,
        qualityScore: schema.memberQuality.qualityScore,
        qualityTier: schema.memberQuality.qualityTier,
      })
      .from(schema.members)
      .leftJoin(schema.memberQuality, eq(schema.memberQuality.memberId, schema.members.id))
      .where(isNotNull(schema.members.eventflowContactId)),
  ]);

  const rosterByEf = new Map(roster.map((r) => [r.ef as string, r]));

  const membersByRegion = Object.fromEntries(
    TERRITORIES.map((t) => [t, [] as RegionMember[]])
  ) as Record<Territory, RegionMember[]>;

  for (const m of board.members) {
    if (!m.key.startsWith("c:")) continue; // only matched members carry a home city
    const info = rosterByEf.get(m.key.slice(2));
    const city = info?.city ?? null;
    membersByRegion[territoryFromCity(city)].push({
      key: m.key,
      name: m.name,
      total: m.total,
      tier: m.tier,
      qualityScore: info?.qualityScore ?? null,
      qualityTier: info?.qualityTier ?? null,
      company: info?.company ?? null,
      email: info?.email ?? null,
      city,
    });
  }

  const summaries: RegionSummary[] = TERRITORIES.map((region) => {
    const list = membersByRegion[region];
    list.sort((a, b) => b.total - a.total);

    const members = list.length;
    const totals = list.map((x) => x.total);
    const sorted = [...totals].sort((a, b) => a - b);
    const sum = totals.reduce((s, t) => s + t, 0);
    const scoredTotals = totals.filter((t) => t > 0);
    const scoredSum = scoredTotals.reduce((s, t) => s + t, 0);
    const median = members
      ? members % 2
        ? sorted[(members - 1) / 2]
        : (sorted[members / 2 - 1] + sorted[members / 2]) / 2
      : 0;
    const champions = list.filter((x) => ACTIVE_PLUS.has(x.tier)).length;
    const q = list.filter((x) => x.qualityScore != null);
    const tierCounts = Object.fromEntries(TIER_NAMES.map((t) => [t, 0])) as Record<TierName, number>;
    for (const x of list) if (x.tier in tierCounts) tierCounts[x.tier as TierName]++;

    return {
      region,
      members,
      scored: scoredTotals.length,
      avgEngagement: members ? Math.round((sum / members) * 10) / 10 : 0,
      avgActive: scoredTotals.length ? Math.round((scoredSum / scoredTotals.length) * 10) / 10 : 0,
      medianEngagement: Math.round(median * 10) / 10,
      engagedRate: members ? Math.round((champions / members) * 1000) / 10 : 0,
      champions,
      dormant: tierCounts.Dormant,
      avgQuality: q.length ? Math.round(q.reduce((s, x) => s + (x.qualityScore ?? 0), 0) / q.length) : null,
      highQuality: list.filter((x) => x.qualityTier && HIGH_Q.has(x.qualityTier)).length,
      tierCounts,
    };
  });

  return {
    computedAt: board.computedAt,
    days,
    totalMembers: summaries.reduce((s, r) => s + r.members, 0),
    summaries,
    membersByRegion,
  };
}

/** Cached wrapper (5 min) — keeps rapid navigation off the DB. */
export function getRegions(days: number): Promise<RegionsData> {
  return unstable_cache(() => fetchRegions(days), ["regions", String(days)], {
    revalidate: 300,
    tags: ["engagement", "snapshots"],
  })();
}

// ── Per-city engagement trend (for the region hotspot map) ──────────────────

export type CityTrend = {
  city: string;
  lat: number;
  lng: number;
  members: number; // roster members in this city
  avgNow: number | null; // avg engagement, latest snapshot week
  delta: number | null; // avgNow - avg ~4 weeks ago; null if insufficient history
  scoredNow: number; // members scored in the latest week (trend confidence)
};

type CityWeekRow = { city: string | null; week: string; avg_total: number; scored: number };

/**
 * Per-city avg engagement for the latest snapshot week vs ~4 weeks prior,
 * scoped to one region. Powers the trend-first hotspot map: which metros are
 * heating up vs cooling off. City comes from the roster join (members'
 * closest_major_city), so it works regardless of the territory value stamped
 * into older snapshots.
 */
export async function fetchRegionCityTrends(region: Territory): Promise<CityTrend[]> {
  const [weekRows, rosterCounts] = await Promise.all([
    meqSql<CityWeekRow[]>`
      WITH latest AS (SELECT MAX(week_start) w FROM member_engagement_snapshots),
      prior AS (
        SELECT week_start w FROM member_engagement_snapshots
        WHERE week_start <= (SELECT w FROM latest) - INTERVAL '28 days'
        ORDER BY week_start DESC LIMIT 1
      )
      SELECT m.closest_major_city city,
             CASE WHEN s.week_start = (SELECT w FROM latest) THEN 'now' ELSE 'prior' END week,
             AVG(s.total)::float avg_total,
             COUNT(*)::int scored
      FROM member_engagement_snapshots s
      JOIN members m ON m.id = s.member_id
      WHERE s.week_start IN ((SELECT w FROM latest), (SELECT w FROM prior))
        AND m.closest_major_city IS NOT NULL
      GROUP BY m.closest_major_city, week`,
    meqSql<{ city: string | null; n: number }[]>`
      SELECT closest_major_city city, COUNT(*)::int n
      FROM members
      WHERE eventflow_contact_id IS NOT NULL AND closest_major_city IS NOT NULL
      GROUP BY closest_major_city`,
  ]);

  const byCity = new Map<string, { now?: CityWeekRow; prior?: CityWeekRow }>();
  for (const r of weekRows) {
    if (!r.city) continue;
    const e = byCity.get(r.city) ?? {};
    if (r.week === "now") e.now = r;
    else e.prior = r;
    byCity.set(r.city, e);
  }

  const out: CityTrend[] = [];
  for (const rc of rosterCounts) {
    const city = rc.city;
    if (!city || territoryFromCity(city) !== region) continue;
    const geo = CITY_GEO[city];
    if (!geo) continue;
    const w = byCity.get(city);
    const avgNow = w?.now ? Math.round(w.now.avg_total * 10) / 10 : null;
    const delta =
      w?.now && w?.prior ? Math.round((w.now.avg_total - w.prior.avg_total) * 10) / 10 : null;
    out.push({
      city,
      lat: geo.lat,
      lng: geo.lng,
      members: rc.n,
      avgNow,
      delta,
      scoredNow: w?.now?.scored ?? 0,
    });
  }
  out.sort((a, b) => b.members - a.members);
  return out;
}

/** Cached wrapper (5 min). */
export function getRegionCityTrends(region: Territory): Promise<CityTrend[]> {
  return unstable_cache(() => fetchRegionCityTrends(region), ["region-city-trends", region], {
    revalidate: 300,
    tags: ["snapshots"],
  })();
}

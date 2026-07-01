import { unstable_cache } from "next/cache";
import { eq, isNotNull } from "drizzle-orm";
import { meqDb, schema } from "./db/meq";
import { getFullLeaderboard } from "./leaderboard";
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

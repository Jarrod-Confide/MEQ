import { unstable_cache } from "next/cache";
import { meqSql } from "./db/meq";
import { territoryFromCity, type Territory } from "./territory";
import { TERRITORY_GOALS, type GoalKey } from "./goals";

export type TrendPoint = {
  week: string;
  scored: number;
  avgTotal: number;
  champion: number;
  active: number;
  engaged: number;
  light: number;
  dormant: number;
  highQuality: number;
};

export type GoalProgress = {
  key: GoalKey;
  target: number;
  actual: number;
  baseline: number | null;
  pct: number; // actual/target
};

export type TerritoryData = {
  territory: Territory;
  week: string | null;
  trend: TrendPoint[];
  // current summary
  members: number;
  avgEngagement: number;
  avgQuality: number | null;
  champions: number;
  dormant: number;
  highQuality: number;
  newIn30d: number;
  movedUp: number; // vs 4 weeks ago
  movedDown: number;
  goals: GoalProgress[];
};

const ACTIVE_PLUS = new Set(["Champion", "Active"]);
const HIGH_Q = new Set(["Platinum", "Gold"]);

type TrendRow = {
  week_start: Date;
  scored: number;
  avg_total: number;
  champion: number;
  active: number;
  engaged: number;
  light: number;
  dormant: number;
  high_quality: number;
};

type MemberSnap = { member_key: string; member_id: string | null; tier: string | null; quality_tier: string | null; events: number };

export async function fetchTerritory(territory: Territory): Promise<TerritoryData> {
  const [trendRows, current, prior4, baseline, newMembers] = await Promise.all([
    // Weekly trend for this territory.
    meqSql<TrendRow[]>`
      SELECT week_start,
             COUNT(*)::int scored,
             ROUND(AVG(total)::numeric, 1)::float avg_total,
             COUNT(*) FILTER (WHERE tier='Champion')::int champion,
             COUNT(*) FILTER (WHERE tier='Active')::int active,
             COUNT(*) FILTER (WHERE tier='Engaged')::int engaged,
             COUNT(*) FILTER (WHERE tier='Light')::int light,
             COUNT(*) FILTER (WHERE tier='Dormant')::int dormant,
             COUNT(*) FILTER (WHERE quality_tier IN ('Platinum','Gold'))::int high_quality
      FROM member_engagement_snapshots
      WHERE territory = ${territory}
      GROUP BY week_start ORDER BY week_start`,
    // Current week member-level rows.
    meqSql<MemberSnap[]>`
      SELECT member_key, member_id, tier, quality_tier,
             COALESCE((dimensions->>'events')::float, 0) events
      FROM member_engagement_snapshots
      WHERE territory = ${territory}
        AND week_start = (SELECT MAX(week_start) FROM member_engagement_snapshots)`,
    // 4 weeks ago (for up/down movement).
    meqSql<MemberSnap[]>`
      SELECT member_key, member_id, tier, quality_tier, 0 events
      FROM member_engagement_snapshots
      WHERE territory = ${territory}
        AND week_start = (
          SELECT week_start FROM member_engagement_snapshots
          WHERE week_start <= (SELECT MAX(week_start) FROM member_engagement_snapshots) - INTERVAL '28 days'
          ORDER BY week_start DESC LIMIT 1)`,
    // Earliest snapshot (quarter baseline) for reactivation/lift.
    meqSql<MemberSnap[]>`
      SELECT member_key, member_id, tier, quality_tier, 0 events
      FROM member_engagement_snapshots
      WHERE territory = ${territory}
        AND week_start = (SELECT MIN(week_start) FROM member_engagement_snapshots)`,
    // New members (joined < 90d) with city → for territory bucketing + activation.
    meqSql<{ member_id: string; city: string | null; joined_at: Date | null }[]>`
      SELECT id member_id, closest_major_city city, joined_at
      FROM members
      WHERE joined_at >= NOW() - INTERVAL '90 days'`,
  ]);

  const trend: TrendPoint[] = trendRows.map((r) => ({
    week: new Date(r.week_start).toISOString().slice(0, 10),
    scored: r.scored,
    avgTotal: r.avg_total ?? 0,
    champion: r.champion,
    active: r.active,
    engaged: r.engaged,
    light: r.light,
    dormant: r.dormant,
    highQuality: r.high_quality,
  }));

  const week = trendRows.length ? new Date(trendRows[trendRows.length - 1].week_start).toISOString() : null;

  // Current summary.
  const members = current.length;
  const champions = current.filter((r) => ACTIVE_PLUS.has(r.tier ?? "")).length;
  const dormant = current.filter((r) => r.tier === "Dormant").length;
  const highQuality = current.filter((r) => HIGH_Q.has(r.quality_tier ?? "")).length;

  // Tier movement vs 4 weeks ago (by member_key).
  const priorTier = new Map(prior4.map((r) => [r.member_key, r.tier]));
  const TIER_RANK: Record<string, number> = { Dormant: 0, Light: 1, Engaged: 2, Active: 3, Champion: 4 };
  let movedUp = 0;
  let movedDown = 0;
  for (const r of current) {
    const before = priorTier.get(r.member_key);
    if (!before || !r.tier) continue;
    const d = (TIER_RANK[r.tier] ?? 0) - (TIER_RANK[before] ?? 0);
    if (d > 0) movedUp++;
    else if (d < 0) movedDown++;
  }

  // New members in this territory (city → territory).
  const newInTerr = newMembers.filter((m) => territoryFromCity(m.city) === territory);
  const newIn30d = newInTerr.filter((m) => m.joined_at && Date.now() - new Date(m.joined_at).getTime() <= 30 * 86400000).length;
  const newIds = new Set(newInTerr.map((m) => m.member_id));
  const currentTierByMember = new Map(current.filter((r) => r.member_id).map((r) => [r.member_id as string, r.tier]));
  const newActivated = [...newIds].filter((id) => ACTIVE_PLUS.has(currentTierByMember.get(id) ?? "")).length;

  // Reactivation: Dormant at baseline → Active+ now.
  const baseTier = new Map(baseline.map((r) => [r.member_key, r.tier]));
  let reactivated = 0;
  for (const r of current) {
    if (baseTier.get(r.member_key) === "Dormant" && ACTIVE_PLUS.has(r.tier ?? "")) reactivated++;
  }
  const baselineActivePlus = baseline.filter((r) => ACTIVE_PLUS.has(r.tier ?? "")).length;
  const eventsAttendees = current.filter((r) => r.events > 0).length;

  // Clean avgEngagement (current rows don't carry total; pull from trend last point).
  const avgEng = trend.length ? trend[trend.length - 1].avgTotal : 0;

  const targets = TERRITORY_GOALS[territory];
  const goals: GoalProgress[] = [
    { key: "engagementLift", target: targets.engagementLift, actual: champions, baseline: baselineActivePlus, pct: targets.engagementLift ? champions / targets.engagementLift : 0 },
    { key: "reactivation", target: targets.reactivation, actual: reactivated, baseline: null, pct: targets.reactivation ? reactivated / targets.reactivation : 0 },
    { key: "events", target: targets.events, actual: eventsAttendees, baseline: null, pct: targets.events ? eventsAttendees / targets.events : 0 },
    { key: "newActivation", target: targets.newActivation, actual: newActivated, baseline: null, pct: targets.newActivation ? newActivated / targets.newActivation : 0 },
    { key: "quality", target: targets.quality, actual: highQuality, baseline: null, pct: targets.quality ? highQuality / targets.quality : 0 },
  ];

  return {
    territory,
    week,
    trend,
    members,
    avgEngagement: avgEng,
    avgQuality: null,
    champions,
    dormant,
    highQuality,
    newIn30d,
    movedUp,
    movedDown,
    goals,
  };
}

/** Cached wrapper (5 min) — keeps rapid territory navigation off the DB. */
export function getTerritory(territory: Territory): Promise<TerritoryData> {
  return unstable_cache(() => fetchTerritory(territory), ["territory", territory], {
    revalidate: 300,
    tags: ["snapshots"],
  })();
}

import { isNotNull } from "drizzle-orm";
import { meqDb, schema } from "./db/meq";
import { getEngagement } from "./engagement-cache";
import { type MemberScore, type Tier, type Dimension } from "./engagement";

export type FullLeaderboard = {
  members: MemberScore[]; // active (scored) + dormant (roster, never active)
  activeCount: number;
  dormantCount: number;
  total: number;
  tierCounts: Record<Tier, number>;
  computedAt: string;
};

const ZERO_DIMS: Record<Dimension, number> = {
  events: 0,
  contribution: 0,
  reciprocity: 0,
  depth: 0,
  reach: 0,
  presence: 0,
  connector: 0,
};

/**
 * The leaderboard over the FULL membership: active members come from the
 * engagement scorer; every other member is appended as a Dormant, 0-score row
 * so the silent majority is visible ("not engaged" is itself a finding). The
 * core scorer + snapshots are untouched — dormant members are added only here.
 */
export async function getFullLeaderboard(days: number): Promise<FullLeaderboard> {
  const [eng, roster] = await Promise.all([
    getEngagement(days),
    meqDb
      .select({
        id: schema.members.id,
        ef: schema.members.eventflowContactId,
        name: schema.members.displayName,
        isMember: schema.members.isMember,
      })
      .from(schema.members)
      .where(isNotNull(schema.members.eventflowContactId)),
  ]);

  const activeEf = new Set<string>();
  for (const m of eng.members) if (m.key.startsWith("c:")) activeEf.add(m.key.slice(2));

  const dormant: MemberScore[] = [];
  for (const r of roster) {
    const ef = r.ef as string;
    if (activeEf.has(ef)) continue; // already scored
    dormant.push({
      key: `c:${ef}`,
      name: r.name ?? "(unknown)",
      email: null,
      hubspotContactId: null,
      isMember: !!r.isMember,
      matched: true,
      dimensions: { ...ZERO_DIMS },
      total: 0,
      tier: "Dormant",
      signals: {
        posts: 0, replies: 0, reactionsGiven: 0, reactionsReceived: 0,
        repliesReceived: 0, eventsAttended: 0, noShows: 0, activeDays: 0,
        connectorActions: 0, avgSubstance: 0,
      },
      lastActiveAt: null,
    });
  }

  const tierCounts: Record<Tier, number> = { ...eng.tierCounts };
  tierCounts.Dormant = (tierCounts.Dormant ?? 0) + dormant.length;

  return {
    members: [...eng.members, ...dormant],
    activeCount: eng.members.length,
    dormantCount: dormant.length,
    total: eng.members.length + dormant.length,
    tierCounts,
    computedAt: eng.computedAt,
  };
}

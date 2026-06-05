import { sql as drizzleSql, eq } from "drizzle-orm";
import { meqDb, schema } from "../db/meq";
import { computeEngagement } from "../engagement";
import { territoryFromCity } from "../territory";
import type { NewMemberEngagementSnapshot } from "../db/schema";

/** Monday 00:00 UTC of the week containing `d`. */
export function weekStartOf(d: Date): Date {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const diff = (x.getUTCDay() + 6) % 7; // days since Monday
  x.setUTCDate(x.getUTCDate() - diff);
  return x;
}

export type SnapshotStats = {
  weekStart: string;
  asOf: string;
  rows: number;
};

/**
 * Write one weekly snapshot of the engagement leaderboard as of `asOf`
 * (defaults to now). Idempotent on (week_start, member_key) — re-running a
 * week overwrites it. Resolves territory + quality by joining the MEQ roster.
 */
export async function writeSnapshot(asOf: Date = new Date()): Promise<SnapshotStats> {
  const weekStart = weekStartOf(asOf);

  const [eng, members] = await Promise.all([
    computeEngagement({ asOf, sinceDays: 90 }),
    meqDb
      .select({
        id: schema.members.id,
        eventflowContactId: schema.members.eventflowContactId,
        city: schema.members.closestMajorCity,
        qualityScore: schema.memberQuality.qualityScore,
        qualityTier: schema.memberQuality.qualityTier,
      })
      .from(schema.members)
      .leftJoin(schema.memberQuality, eq(schema.memberQuality.memberId, schema.members.id)),
  ]);

  const byEf = new Map(members.filter((m) => m.eventflowContactId).map((m) => [m.eventflowContactId as string, m]));

  const rows: NewMemberEngagementSnapshot[] = eng.members.map((m) => {
    const ef = m.key.startsWith("c:") ? m.key.slice(2) : null;
    const member = ef ? byEf.get(ef) : undefined;
    return {
      weekStart,
      memberKey: m.key,
      eventflowContactId: ef,
      memberId: member?.id ?? null,
      name: m.name,
      isMember: m.isMember,
      matched: m.matched,
      territory: member ? territoryFromCity(member.city) : "INTL",
      total: m.total,
      tier: m.tier,
      dimensions: m.dimensions as Record<string, number>,
      qualityScore: member?.qualityScore ?? null,
      qualityTier: member?.qualityTier ?? null,
    };
  });

  // Upsert in chunks.
  const CHUNK = 500;
  for (let i = 0; i < rows.length; i += CHUNK) {
    await meqDb
      .insert(schema.memberEngagementSnapshots)
      .values(rows.slice(i, i + CHUNK))
      .onConflictDoUpdate({
        target: [
          schema.memberEngagementSnapshots.weekStart,
          schema.memberEngagementSnapshots.memberKey,
        ],
        set: {
          eventflowContactId: drizzleSql`excluded.eventflow_contact_id`,
          memberId: drizzleSql`excluded.member_id`,
          name: drizzleSql`excluded.name`,
          isMember: drizzleSql`excluded.is_member`,
          matched: drizzleSql`excluded.matched`,
          territory: drizzleSql`excluded.territory`,
          total: drizzleSql`excluded.total`,
          tier: drizzleSql`excluded.tier`,
          dimensions: drizzleSql`excluded.dimensions`,
          qualityScore: drizzleSql`excluded.quality_score`,
          qualityTier: drizzleSql`excluded.quality_tier`,
        },
      });
  }

  return { weekStart: weekStart.toISOString(), asOf: asOf.toISOString(), rows: rows.length };
}

/**
 * Backfill the last `weeks` weekly snapshots retroactively, reconstructing the
 * leaderboard as-of each past week (thanks to timestamped messages/reactions/
 * attendance + persisted per-message substance). Quality is current-as-of-run
 * (no quality history exists pre-snapshot), so older weeks carry today's
 * quality — acceptable since quality is slow-moving.
 */
export async function backfillSnapshots(weeks = 12): Promise<SnapshotStats[]> {
  const out: SnapshotStats[] = [];
  const now = new Date();
  for (let i = weeks - 1; i >= 0; i--) {
    const asOf = new Date(now.getTime() - i * 7 * 86400000);
    out.push(await writeSnapshot(asOf));
  }
  return out;
}

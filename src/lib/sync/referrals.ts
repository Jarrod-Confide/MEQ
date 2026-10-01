import { sql } from "drizzle-orm";
import { meqDb, schema } from "../db/meq";
import type { NewMemberReferral } from "../db/schema";
import { buildPersonIndex, classifyReferrer, type ReferralStatus } from "../referral-matching";

export { normalizeName } from "../referral-matching";

export type ReferralStats = { seen: number } & Record<ReferralStatus, number>;

/**
 * Resolve HubSpot 'Referred/Invited By' free text → staff / member /
 * ambiguous / unmatched / ignored (rules in lib/referral-matching.ts) and
 * upsert member_referrals. Runs inside the daily quality sync; fully
 * re-resolves every run so new staff entries, aliases, and roster changes
 * take effect without manual repair.
 */
export async function resolveReferrals(
  pairs: { referredMemberId: string; rawName: string }[]
): Promise<ReferralStats> {
  const [staffRows, memberRows] = await Promise.all([
    meqDb
      .select({ id: schema.staff.id, name: schema.staff.name, aliases: schema.staff.aliases })
      .from(schema.staff),
    meqDb
      .select({ id: schema.members.id, name: schema.members.displayName, joinedAt: schema.members.joinedAt })
      .from(schema.members),
  ]);

  const index = buildPersonIndex(staffRows, memberRows);
  const joinedById = new Map(memberRows.map((m) => [m.id, m.joinedAt]));

  const stats: ReferralStats = { seen: 0, staff: 0, member: 0, ambiguous: 0, unmatched: 0, ignored: 0 };
  // Keyed by referredMemberId — merged HubSpot contacts can resolve to the
  // same canonical member, and a batch upsert can't touch one row twice.
  const byReferred = new Map<string, NewMemberReferral>();
  const now = new Date();

  for (const p of pairs) {
    const c = classifyReferrer(p.rawName, index);
    stats.seen += 1;
    stats[c.status] += 1;
    byReferred.set(p.referredMemberId, {
      referredMemberId: p.referredMemberId,
      referrerMemberId: c.referrerMemberId,
      referrerStaffId: c.referrerStaffId,
      rawName: p.rawName,
      normalizedRaw: c.normalized,
      status: c.status,
      referredJoinedAt: joinedById.get(p.referredMemberId) ?? null,
      updatedAt: now,
    });
  }

  const values = [...byReferred.values()];
  const CHUNK = 500;
  for (let i = 0; i < values.length; i += CHUNK) {
    await meqDb
      .insert(schema.memberReferrals)
      .values(values.slice(i, i + CHUNK))
      .onConflictDoUpdate({
        target: schema.memberReferrals.referredMemberId,
        set: {
          referrerMemberId: sql`excluded.referrer_member_id`,
          referrerStaffId: sql`excluded.referrer_staff_id`,
          rawName: sql`excluded.raw_name`,
          normalizedRaw: sql`excluded.normalized_raw`,
          status: sql`excluded.status`,
          referredJoinedAt: sql`excluded.referred_joined_at`,
          updatedAt: sql`excluded.updated_at`,
        },
      });
  }

  return stats;
}

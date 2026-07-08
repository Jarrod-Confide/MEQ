import { sql } from "drizzle-orm";
import { meqDb, schema } from "../db/meq";
import type { NewMemberReferral } from "../db/schema";

export type ReferralStats = {
  seen: number;
  member: number;
  staff: number;
  unmatched: number;
  ignored: number;
};

// Free-text values that mean "no real referrer".
const JUNK = new Set([
  "", "n/a", "na", "none", "no", "-", "--", "self", "myself", "me",
  "linkedin", "google", "website", "web", "internet", "email", "unknown", "n a",
]);

/**
 * Normalize a free-text person name for matching: lowercase, strip
 * punctuation, drop generational suffixes, collapse whitespace.
 * "Larry  Whiteside Jr." → "larry whiteside".
 */
export function normalizeName(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[.,'"()]/g, " ")
    .split(/\s+/)
    .filter((t) => t && !["jr", "sr", "ii", "iii", "iv"].includes(t))
    .join(" ")
    .trim();
}

/**
 * Resolve HubSpot 'Referred/Invited By' free text → member / staff /
 * unmatched / ignored, and upsert member_referrals. Runs inside the daily
 * quality sync; fully re-resolves every run so new staff entries, aliases,
 * and roster changes take effect without manual repair.
 */
export async function resolveReferrals(
  pairs: { referredMemberId: string; rawName: string }[]
): Promise<ReferralStats> {
  const [staffRows, memberRows] = await Promise.all([
    meqDb.select({ id: schema.staff.id, norm: schema.staff.normalizedName, aliases: schema.staff.aliases }).from(schema.staff),
    meqDb
      .select({ id: schema.members.id, name: schema.members.displayName, joinedAt: schema.members.joinedAt })
      .from(schema.members),
  ]);

  // normalized name → staff id (canonical names + aliases)
  const staffByNorm = new Map<string, string>();
  for (const s of staffRows) {
    staffByNorm.set(s.norm, s.id);
    for (const a of s.aliases ?? []) staffByNorm.set(normalizeName(a), s.id);
  }

  // normalized display name → member id; ambiguous names (2+ members) drop out.
  const memberByNorm = new Map<string, string | null>();
  const joinedById = new Map<string, Date | null>();
  for (const m of memberRows) {
    joinedById.set(m.id, m.joinedAt);
    if (!m.name) continue;
    const norm = normalizeName(m.name);
    if (!norm) continue;
    memberByNorm.set(norm, memberByNorm.has(norm) ? null : m.id);
  }

  const stats: ReferralStats = { seen: 0, member: 0, staff: 0, unmatched: 0, ignored: 0 };
  const values: NewMemberReferral[] = [];
  const now = new Date();

  for (const p of pairs) {
    const norm = normalizeName(p.rawName);
    stats.seen += 1;

    let status: NewMemberReferral["status"];
    let referrerMemberId: string | null = null;
    let referrerStaffId: string | null = null;

    if (JUNK.has(norm)) {
      status = "ignored";
      stats.ignored += 1;
    } else if (staffByNorm.has(norm)) {
      status = "staff";
      referrerStaffId = staffByNorm.get(norm)!;
      stats.staff += 1;
    } else if (memberByNorm.get(norm)) {
      status = "member";
      referrerMemberId = memberByNorm.get(norm)!;
      stats.member += 1;
    } else {
      status = "unmatched";
      stats.unmatched += 1;
    }

    values.push({
      referredMemberId: p.referredMemberId,
      referrerMemberId,
      referrerStaffId,
      rawName: p.rawName,
      normalizedRaw: norm,
      status,
      referredJoinedAt: joinedById.get(p.referredMemberId) ?? null,
      updatedAt: now,
    });
  }

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

import { callerFor } from "@/lib/api-auth";
import { meqSql } from "@/lib/db/meq";
import { readStoredEngagement } from "@/lib/engagement-store";
import { safeIso } from "@/lib/safe-date";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/member-scores: each member's engagement and quality scores,
 * keyed by MemberHub member number, for MemberHub to show on its member
 * list, Speakers cards and profiles (it copies this once a night).
 *
 * Stored data only (the materialized engagement_cache rows + member_quality,
 * all in MEQ's own database): never computes engagement per request.
 * Current members with a member number; a member with no activity in the
 * window is Dormant with score 0.
 *
 * Scales: engagementScore and qualityScore are 0 to 100.
 *   Engagement tier is by rank among members active in the 90-day window:
 *   top 10% Champion, next 20% Active, next 30% Engaged, next 30% Light,
 *   last 10% Dormant; no activity at all = Dormant.
 *   Quality tier: 80+ Platinum, 60+ Gold, 40+ Silver, 20+ Bronze, else Unranked.
 */
export async function GET(req: Request) {
  if (callerFor(req) !== "memberhub") {
    return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const [recent, allTime, roster] = await Promise.all([
    readStoredEngagement(90),
    readStoredEngagement(9999),
    meqSql<{ member_number: number; ef: string | null; quality_score: number | null; quality_tier: string | null }[]>`
      SELECT m.member_number, m.eventflow_contact_id::text AS ef, q.quality_score, q.quality_tier
        FROM members m
        LEFT JOIN member_quality q ON q.member_id = m.id
       WHERE m.is_member AND m.member_number IS NOT NULL`,
  ]);
  if (!recent || !allTime) {
    return Response.json({ ok: false, error: "not_computed_yet" }, { status: 503 });
  }

  const recentByKey = new Map(recent.members.map((m) => [m.key, m]));
  const allTimeByKey = new Map(allTime.members.map((m) => [m.key, m]));
  const members = roster.map((r) => {
    const key = r.ef ? `c:${r.ef}` : null;
    const s90 = key ? recentByKey.get(key) : undefined;
    const sAll = key ? allTimeByKey.get(key) : undefined;
    return {
      memberNumber: Number(r.member_number),
      engagementScore: s90?.total ?? 0,
      engagementTier: s90?.tier ?? "Dormant",
      engagementScoreAllTime: sAll?.total ?? 0,
      qualityScore: r.quality_score,
      qualityTier: r.quality_tier ?? "Unranked",
      lastActiveAt: safeIso(sAll?.lastActiveAt ?? s90?.lastActiveAt ?? null),
    };
  });

  return Response.json(
    { ok: true, computedAt: recent.computedAt, members },
    { headers: { "cache-control": "no-store" } }
  );
}

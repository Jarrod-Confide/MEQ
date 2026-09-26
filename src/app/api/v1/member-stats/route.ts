import { callerFor } from "@/lib/api-auth";
import { readStoredEngagement } from "@/lib/engagement-store";
import { meqSql } from "@/lib/db/meq";
import { territoryFromCity } from "@/lib/territory";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Per-member engagement facts for EventFlow's check-in card (2026-09-25).
 *
 *   GET /api/v1/member-stats
 *   Authorization: Bearer <MEQ_TOKEN_EVENTFLOW>
 *
 * READS THE STORED LEADERBOARD ONLY (engagement_cache, MEQ's own DB, two
 * rows). It never computes engagement and never touches EventFlow's or
 * Slackle's database, so it cannot cause the multi-DB fan-out that locked
 * MEQ up. EventFlow calls it nightly and keeps a copy; the door never
 * calls it live.
 *
 * Members matched to an EventFlow contact only, keyed by that contact id.
 *   tier         90-day tier (Champion / Active / Engaged / Light / Dormant)
 *   slackPosts   all-time Slack posts + replies
 *   referrals    all-time members they referred
 *   lastSlackAt  last Slack post or reaction (null until the next refresh
 *                after this field was added)
 *   region       MEQ territory from their closest major city, the same
 *                territoryFromCity MEQ's own territory pages use
 *                (NE / CENTRAL / WEST / SE / OTHER). Added 2026-09-26 for
 *                EventFlow's Needs attention alert, which tags the region's
 *                community manager.
 */
export async function GET(req: Request) {
  if (!callerFor(req)) {
    return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const [recent, allTime, cities] = await Promise.all([
    readStoredEngagement(90),
    readStoredEngagement(9999),
    // MEQ's own roster, one query, same database as the two above.
    meqSql<{ contact_id: string; city: string | null }[]>`
      SELECT eventflow_contact_id::text AS contact_id, closest_major_city AS city
        FROM members
       WHERE eventflow_contact_id IS NOT NULL`,
  ]);
  if (!allTime) {
    return Response.json({ ok: false, error: "not_computed_yet" }, { status: 503 });
  }

  const tierByKey = new Map((recent?.members ?? []).map((m) => [m.key, m.tier]));
  const cityByContact = new Map(cities.map((c) => [c.contact_id, c.city]));
  const members = allTime.members
    .filter((m) => m.matched && m.isMember && m.key.startsWith("c:"))
    .map((m) => ({
      contactId: m.key.slice(2),
      tier: tierByKey.get(m.key) ?? "Dormant",
      slackPosts: (m.signals?.posts ?? 0) + (m.signals?.replies ?? 0),
      referrals: m.signals?.referrals ?? 0,
      lastSlackAt: m.lastSlackAt ?? null,
      region: territoryFromCity(cityByContact.get(m.key.slice(2)) ?? null),
    }));

  return Response.json(
    { ok: true, computedAt: allTime.computedAt, members },
    { headers: { "cache-control": "no-store" } }
  );
}

/**
 * Data-freshness rules for /api/health. Confide Heartbeat polls that route
 * every minute and posts to #system-status when it flips, so a cron that
 * silently stops running (never invoked, or dies before its own alert code)
 * shows up within minutes instead of whenever someone notices stale numbers.
 *
 * Each window allows a few missed runs before alarming, so one slow or
 * skipped invocation never pages anyone.
 */

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

/** refresh-engagement runs every 10 min → alarm after ~4 missed runs. */
export const ENGAGEMENT_MAX_AGE_MS = 45 * MIN;
/** sync-members runs daily at 06:00 UTC → alarm when a whole run is missed. */
export const SYNC_MAX_AGE_MS = 26 * HOUR;
/** snapshot runs Mondays 07:00 UTC for week_start = Monday 00:00 → a week + a day of grace. */
export const SNAPSHOT_MAX_AGE_MS = 8 * DAY;

export type FreshnessFacts = {
  engagementComputedAt: Date | string | null;
  lastSyncOkAt: Date | string | null;
  latestSnapshotWeek: Date | string | null;
};

export type FreshnessCheck = { status: "ok" | "stale"; ageMinutes: number | null };

function check(at: Date | string | null, maxAgeMs: number, now: number): FreshnessCheck {
  const t = at == null ? NaN : new Date(at).getTime();
  if (isNaN(t)) return { status: "stale", ageMinutes: null }; // never ran
  const age = Math.max(0, now - t);
  return { status: age > maxAgeMs ? "stale" : "ok", ageMinutes: Math.round(age / MIN) };
}

export function assessFreshness(
  facts: FreshnessFacts,
  now: Date = new Date()
): Record<"engagement" | "sync" | "snapshot", FreshnessCheck> {
  const n = now.getTime();
  return {
    engagement: check(facts.engagementComputedAt, ENGAGEMENT_MAX_AGE_MS, n),
    sync: check(facts.lastSyncOkAt, SYNC_MAX_AGE_MS, n),
    snapshot: check(facts.latestSnapshotWeek, SNAPSHOT_MAX_AGE_MS, n),
  };
}

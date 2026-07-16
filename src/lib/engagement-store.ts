import { sql } from "drizzle-orm";
import { meqDb, meqSql, schema } from "./db/meq";
import { computeEngagement, type EngagementResult } from "./engagement";

/**
 * Materialized engagement leaderboard (engagement_cache table).
 *
 * computeEngagement fans out 7 queries across all three Supabase databases —
 * far too heavy for the request path: concurrent cache-miss stampedes from
 * tab-switching exhausted the shared poolers and hung every page (the
 * recurring "MEQ locks up" complaint). So the compute now happens on a
 * schedule (cron every 10 min + after "Refresh now"), and requests only ever
 * read the stored result — one cheap query against MEQ's own DB.
 */

export const ENGAGEMENT_WINDOWS = [30, 90, 180, 9999] as const;

// Advisory lock namespace for the first-boot fallback compute (arbitrary
// constant; only needs to be consistent across instances).
const LOCK_KEY = 811_442;

export async function readStoredEngagement(days: number): Promise<EngagementResult | null> {
  const rows = await meqSql<{ payload: EngagementResult }[]>`
    SELECT payload FROM engagement_cache WHERE window_days = ${days}`;
  return rows[0]?.payload ?? null;
}

/** Compute one window and upsert it. Returns the result. */
export async function computeAndStoreEngagement(days: number): Promise<EngagementResult> {
  const t0 = Date.now();
  const result = await computeEngagement({ sinceDays: days });
  await meqDb
    .insert(schema.engagementCache)
    .values({
      windowDays: days,
      payload: result,
      computedAt: new Date(),
      durationMs: Date.now() - t0,
    })
    .onConflictDoUpdate({
      target: schema.engagementCache.windowDays,
      set: {
        payload: sql`excluded.payload`,
        computedAt: sql`excluded.computed_at`,
        durationMs: sql`excluded.duration_ms`,
      },
    });
  return result;
}

/**
 * Request-path read. Serves the stored row — however old — and NEVER
 * recomputes when a row exists (freshness is the cron's job; staleness is
 * always preferable to a request-path stampede). Only when the window has
 * never been computed (first boot after the migration) does it compute
 * inline, behind a pg advisory lock so exactly one instance does the work
 * while the rest poll for its result.
 */
export async function getEngagementStored(days: number): Promise<EngagementResult> {
  const stored = await readStoredEngagement(days);
  if (stored) return stored;

  const [lock] = await meqSql<{ ok: boolean }[]>`
    SELECT pg_try_advisory_lock(${LOCK_KEY}, ${days}) AS ok`;
  if (lock.ok) {
    try {
      return await computeAndStoreEngagement(days);
    } finally {
      await meqSql`SELECT pg_advisory_unlock(${LOCK_KEY}, ${days})`;
    }
  }

  // Another instance is computing — poll briefly for its result.
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 1500));
    const row = await readStoredEngagement(days);
    if (row) return row;
  }
  // Lock holder died mid-compute; last resort so the page still renders.
  return computeAndStoreEngagement(days);
}

import { NextResponse } from "next/server";
import { meqSql } from "@/lib/db/meq";
import { eventflowSql, slackleSql } from "@/lib/db";
import { assessFreshness, type FreshnessCheck } from "@/lib/freshness";

export const dynamic = "force-dynamic";

/**
 * Health check for uptime monitoring (Confide Heartbeat, every minute →
 * #system-status). 200 only if all three databases are reachable AND the
 * scheduled jobs are keeping data fresh (see lib/freshness.ts); else 503,
 * with `checks` saying which part failed and `ageMinutes` how stale it is.
 */
export async function GET() {
  const checks: Record<string, "ok" | "down" | "stale"> = {};
  const probe = async (name: string, fn: () => Promise<unknown>) => {
    try {
      await fn();
      checks[name] = "ok";
    } catch {
      checks[name] = "down";
    }
  };

  let freshness: Record<string, FreshnessCheck> | null = null;
  await Promise.all([
    probe("meq", async () => {
      // One round trip: reachability + the three freshness timestamps.
      const [row] = await meqSql<{ eng: Date | null; sync: Date | null; snap: Date | null }[]>`
        SELECT (SELECT MAX(computed_at) FROM engagement_cache) AS eng,
               (SELECT MAX(started_at) FROM member_sync_runs WHERE ok) AS sync,
               (SELECT MAX(week_start) FROM member_engagement_snapshots) AS snap`;
      freshness = assessFreshness({
        engagementComputedAt: row.eng,
        lastSyncOkAt: row.sync,
        latestSnapshotWeek: row.snap,
      });
    }),
    probe("eventflow", () => eventflowSql`SELECT 1`),
    probe("slackle", () => slackleSql`SELECT 1`),
  ]);

  if (freshness) {
    for (const [name, f] of Object.entries(freshness as Record<string, FreshnessCheck>)) {
      checks[name] = f.status;
    }
  }

  const ok = Object.values(checks).every((v) => v === "ok");
  return NextResponse.json(
    { ok, checks, freshness, at: new Date().toISOString() },
    { status: ok ? 200 : 503 }
  );
}

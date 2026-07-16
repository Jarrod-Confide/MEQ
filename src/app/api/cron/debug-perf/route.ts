import { NextResponse } from "next/server";
import { meqSql, meqDb, schema } from "@/lib/db/meq";
import { eventflowSql, slackleSql } from "@/lib/db";
import { readStoredEngagement } from "@/lib/engagement-store";
import { getEngagement } from "@/lib/engagement-cache";
import { getFullLeaderboard } from "@/lib/leaderboard";
import { fetchDashboard } from "@/lib/dashboard-data";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const STEP_TIMEOUT_MS = 8000;

/** TEMPORARY diagnostics — per-step timings with individual timeouts so a
 * hang identifies itself instead of killing the function. CRON_SECRET-gated. */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const timings: Record<string, string> = {};
  const step = async (label: string, fn: () => Promise<unknown>) => {
    const t0 = Date.now();
    try {
      await Promise.race([
        fn(),
        new Promise((_, rej) => setTimeout(() => rej(new Error("STEP_TIMEOUT")), STEP_TIMEOUT_MS)),
      ]);
      timings[label] = `${Date.now() - t0}ms`;
    } catch (e) {
      const msg = e instanceof Error && e.message === "STEP_TIMEOUT" ? "HUNG >8s" : String(e).slice(0, 160);
      timings[label] = `FAIL after ${Date.now() - t0}ms — ${msg}`;
    }
  };

  await step("meq SELECT 1", () => meqSql`SELECT 1`);
  await step("eventflow SELECT 1", () => eventflowSql`SELECT 1`);
  await step("slackle SELECT 1", () => slackleSql`SELECT 1`);
  await step("payload size (90)", () => meqSql`SELECT octet_length(payload::text) FROM engagement_cache WHERE window_days = 90`);
  await step("readStored(90) full", () => readStoredEngagement(90));
  await step("readStored(30) full", () => readStoredEngagement(30));
  await step("roster select (drizzle)", () => meqDb.select({ id: schema.members.id }).from(schema.members).limit(5));
  await step("getFullLeaderboard(90)", () => getFullLeaderboard(90));
  // fetchDashboard split in half to isolate the hang:
  await step("dash raw queries (parallel)", () =>
    Promise.all([
      meqSql`SELECT COUNT(*)::int AS total FROM members`,
      meqSql`SELECT to_char(date_trunc('month', joined_at), 'YYYY-MM') AS month, COUNT(*)::int FROM members WHERE joined_at >= date_trunc('month', NOW() - INTERVAL '11 months') GROUP BY 1`,
      meqSql`SELECT COALESCE(quality_tier,'Unranked') tier, COUNT(*)::int n FROM member_quality GROUP BY 1`,
      meqSql`SELECT closest_major_city, COUNT(*)::int FROM members WHERE closest_major_city IS NOT NULL GROUP BY 1 ORDER BY 2 DESC LIMIT 5`,
      meqSql`SELECT company, COUNT(*)::int FROM member_quality WHERE company IS NOT NULL GROUP BY 1 ORDER BY 2 DESC LIMIT 5`,
      meqSql`SELECT COUNT(*) FILTER (WHERE is_fortune_2000)::int f2000 FROM member_quality`,
      eventflowSql`SELECT COUNT(DISTINCT a.contact_id)::int n FROM attendees a JOIN events e ON a.event_id = e.id WHERE a.status='attended' AND e.starts_at >= NOW() - INTERVAL '30 days'`,
      meqSql`SELECT week_start, COUNT(*)::int FROM member_engagement_snapshots GROUP BY week_start`,
    ])
  );
  await step("eng90 + eng30 (parallel unstable_cache)", () =>
    Promise.all([getEngagement(90), getEngagement(30)])
  );
  await step("fetchDashboard", () => fetchDashboard());

  return NextResponse.json({ ok: true, timings });
}

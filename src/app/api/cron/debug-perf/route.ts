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
  // NOTE: an earlier probe step ran 8 queries in ONE Promise.all to prove the
  // pool-wedge mechanism — it reliably hung. Do not reintroduce wide batches.
  await step("eng90 + eng30 (parallel unstable_cache)", () =>
    Promise.all([getEngagement(90), getEngagement(30)])
  );
  await step("fetchDashboard", () => fetchDashboard());
  await step("fetchDashboard (again)", () => fetchDashboard());

  return NextResponse.json({ ok: true, timings });
}

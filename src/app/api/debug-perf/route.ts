import { NextResponse } from "next/server";
import { readStoredEngagement } from "@/lib/engagement-store";
import { getFullLeaderboard } from "@/lib/leaderboard";
import { fetchDashboard } from "@/lib/dashboard-data";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** TEMPORARY diagnostics — times each production data path. CRON_SECRET-gated. */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const timings: Record<string, number | string> = {};
  const time = async (label: string, fn: () => Promise<unknown>) => {
    const t0 = Date.now();
    try {
      const r = await fn();
      timings[label] = Date.now() - t0;
      return r;
    } catch (e) {
      timings[label] = `ERROR after ${Date.now() - t0}ms: ${String(e).slice(0, 200)}`;
      return null;
    }
  };

  const stored = await time("readStored(90)", () => readStoredEngagement(90));
  timings["payloadKB(90)"] = stored ? Math.round(JSON.stringify(stored).length / 1024) : "null";
  await time("readStored(30)", () => readStoredEngagement(30));
  await time("getFullLeaderboard(90)", () => getFullLeaderboard(90));
  await time("fetchDashboard", () => fetchDashboard());

  return NextResponse.json({ ok: true, timings });
}

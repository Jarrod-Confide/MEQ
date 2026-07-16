import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { ENGAGEMENT_TAG } from "@/lib/engagement-cache";
import { computeAndStoreEngagement, ENGAGEMENT_WINDOWS } from "@/lib/engagement-store";
import { notifySlack } from "@/lib/alert";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * Refresh the materialized engagement leaderboard (every 10 min via Vercel
 * Cron). Keeping the heavy 3-database compute HERE — and only here — is what
 * keeps page navigation cheap and stampede-proof.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const timings: Record<string, number> = {};
    for (const days of ENGAGEMENT_WINDOWS) {
      const t0 = Date.now();
      await computeAndStoreEngagement(days);
      timings[`${days}d`] = Date.now() - t0;
    }
    revalidateTag(ENGAGEMENT_TAG);
    return NextResponse.json({ ok: true, timings });
  } catch (err) {
    await notifySlack(`engagement refresh cron failed — ${String(err).slice(0, 300)}`);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

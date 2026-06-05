import { NextResponse } from "next/server";
import { writeSnapshot, backfillSnapshots } from "@/lib/sync/snapshots";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Weekly engagement snapshot. Triggered by Vercel Cron
 * (`Authorization: Bearer <CRON_SECRET>`). Pass `?backfill=N` to retroactively
 * reconstruct the last N weekly snapshots in one call.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const backfill = url.searchParams.get("backfill");

  try {
    if (backfill) {
      const stats = await backfillSnapshots(Math.max(1, Number(backfill)));
      return NextResponse.json({ ok: true, mode: "backfill", weeks: stats.length, stats });
    }
    const stats = await writeSnapshot();
    return NextResponse.json({ ok: true, mode: "weekly", ...stats });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

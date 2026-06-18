import { NextResponse } from "next/server";
import { syncMembers } from "@/lib/sync/members";
import { enrichQuality } from "@/lib/sync/quality";
import { notifySlack } from "@/lib/alert";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * Daily member roster sync. Triggered by Vercel Cron (sends
 * `Authorization: Bearer <CRON_SECRET>`). Also runnable manually with the
 * same header for an on-demand refresh.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const members = await syncMembers();
    const quality = await enrichQuality();
    return NextResponse.json({ ok: true, members, quality });
  } catch (err) {
    await notifySlack(`member sync cron failed — ${String(err).slice(0, 300)}`);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

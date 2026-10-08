import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { refreshMilestones } from "@/lib/sync/milestones";
import { notifySlack } from "@/lib/alert";
import { NEW_MEMBERS_TAG } from "@/lib/new-members-data";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Hourly: each member's first engagement after joining (Vercel Cron, Bearer CRON_SECRET). */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const stats = await refreshMilestones();
    revalidateTag(NEW_MEMBERS_TAG);
    return NextResponse.json({ ok: true, ...stats });
  } catch (err) {
    await notifySlack(`refresh-milestones cron failed: ${String(err).slice(0, 300)}`);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

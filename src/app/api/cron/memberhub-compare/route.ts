import { NextResponse } from "next/server";
import { syncMembersFromMemberHub } from "@/lib/sync/members-memberhub";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * Dry run of the MemberHub member sync: reads MemberHub and MEQ, writes
 * nothing, returns the comparison (matched, created, leavers, duplicates,
 * region and join-date changes). Bearer CRON_SECRET. Run before flipping
 * MEMBER_SOURCE to memberhub.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const report = await syncMembersFromMemberHub({ dryRun: true });
    return NextResponse.json({ ok: true, source: process.env.MEMBER_SOURCE ?? "eventflow", ...report });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

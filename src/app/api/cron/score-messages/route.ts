import { NextResponse } from "next/server";
import { scoreMessages } from "@/lib/sync/message-scores";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Score unscored Slackle messages with the CISO content rubric (Haiku).
 * Incremental + idempotent — only messages without a message_scores row cost
 * tokens. Triggered by Vercel Cron (`Authorization: Bearer <CRON_SECRET>`) or
 * manually for backfill. Optional `?limit=N` caps messages per run (keeps a
 * single invocation under maxDuration during a large backfill).
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const limitParam = url.searchParams.get("limit");
  const limit = limitParam ? Math.max(1, Number(limitParam)) : undefined;

  try {
    const stats = await scoreMessages({ limit });
    return NextResponse.json({ ok: true, ...stats });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

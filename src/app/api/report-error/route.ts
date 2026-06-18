import { NextResponse } from "next/server";
import { notifySlack } from "@/lib/alert";

export const dynamic = "force-dynamic";

/** Receives client-side render errors from the error boundary → Slack alert. */
export async function POST(request: Request) {
  try {
    const { message, digest, path } = await request.json();
    await notifySlack(
      `page error on \`${path ?? "?"}\` — ${String(message).slice(0, 300)}${digest ? ` (ref ${digest})` : ""}`
    );
  } catch {
    // ignore malformed reports
  }
  return NextResponse.json({ ok: true });
}

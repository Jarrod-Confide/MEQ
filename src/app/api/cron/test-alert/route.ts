import { NextResponse } from "next/server";
import { notifySlack } from "@/lib/alert";

export const dynamic = "force-dynamic";

/**
 * Posts a test message to #system-status to prove alerting works end to end
 * (env var set, webhook valid, Slack reachable). Bearer CRON_SECRET; not
 * scheduled. Use it after rotating SLACK_ALERT_WEBHOOK.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!process.env.SLACK_ALERT_WEBHOOK) {
    return NextResponse.json({ ok: false, error: "SLACK_ALERT_WEBHOOK is not set" }, { status: 500 });
  }
  const delivered = await notifySlack(
    "test alert: MEQ is connected to #system-status. Cron failures and page errors will post here."
  );
  return NextResponse.json({ ok: delivered, delivered }, { status: delivered ? 200 : 502 });
}

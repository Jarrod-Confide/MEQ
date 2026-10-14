/**
 * Fire-and-forget Slack alert to #system-status. Used for page errors + cron
 * failures. Returns whether Slack accepted the message (callers may ignore
 * it; /api/cron/test-alert reports it).
 *
 * Preferred path: the shared Confide "Status Alerts" bot (SLACK_ALERTS_BOT_TOKEN
 * + SLACK_ALERTS_CHANNEL_ID), posting under the name "MEQ". Fallback, or if
 * the bot isn't set up: the SLACK_ALERT_WEBHOOK incoming webhook (which can't
 * be renamed). No-ops when neither is set, so it's safe in every environment.
 */
export async function notifySlack(text: string): Promise<boolean> {
  const message = `:rotating_light: *MEQ* · ${text}`;
  const token = process.env.SLACK_ALERTS_BOT_TOKEN?.trim();
  const channel = process.env.SLACK_ALERTS_CHANNEL_ID?.trim();
  if (token && channel) {
    try {
      const res = await fetch("https://slack.com/api/chat.postMessage", {
        method: "POST",
        headers: { "content-type": "application/json; charset=utf-8", authorization: `Bearer ${token}` },
        body: JSON.stringify({ channel, text: message, username: "MEQ", unfurl_links: false }),
      });
      const body = (await res.json().catch(() => null)) as { ok?: boolean } | null;
      if (body?.ok) return true;
    } catch {
      // fall through to the webhook
    }
  }
  const url = process.env.SLACK_ALERT_WEBHOOK;
  if (!url) return false;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: message }),
    });
    return res.ok;
  } catch {
    return false; // never let alerting break the request
  }
}

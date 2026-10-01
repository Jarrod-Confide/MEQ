/**
 * Fire-and-forget Slack alert to #system-status. No-ops unless
 * SLACK_ALERT_WEBHOOK is set, so it's safe in every environment. Used for
 * page errors + cron failures. Returns whether Slack accepted the message
 * (callers may ignore it; /api/cron/test-alert reports it).
 */
export async function notifySlack(text: string): Promise<boolean> {
  const url = process.env.SLACK_ALERT_WEBHOOK;
  if (!url) return false;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: `:rotating_light: *MEQ* · ${text}` }),
    });
    return res.ok;
  } catch {
    return false; // never let alerting break the request
  }
}

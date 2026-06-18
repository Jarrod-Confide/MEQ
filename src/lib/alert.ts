/**
 * Fire-and-forget Slack alert. No-ops unless SLACK_ALERT_WEBHOOK is set, so
 * it's safe in every environment. Used for page errors + cron failures.
 * Add the incoming-webhook URL to Vercel env to turn alerts on.
 */
export async function notifySlack(text: string): Promise<void> {
  const url = process.env.SLACK_ALERT_WEBHOOK;
  if (!url) return;
  try {
    await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: `:rotating_light: *MEQ* — ${text}` }),
    });
  } catch {
    // never let alerting break the request
  }
}

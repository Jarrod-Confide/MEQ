/**
 * Passive email engagement tier from HubSpot. Clicks are the trusted signal
 * (a click is a deliberate human action); opens are discounted to a weak tier
 * because Apple Mail Privacy Protection auto-opens inflate them. Recency-gated
 * to ~90 days so it reflects "paying attention lately", not all-time.
 */
export type PassiveTier = "Clicker" | "Opener" | "Cold" | null;

export const PASSIVE_COLOR: Record<Exclude<PassiveTier, null>, string> = {
  Clicker: "#22c55e", // clicked recently — strong
  Opener: "#facc15", // opened recently, no recent click — weak
  Cold: "#6a7da0", // emailed but quiet
};

const WINDOW_MS = 90 * 86400000;

export function passiveTier(
  emailClicks: number | null,
  lastClickAt: Date | string | null,
  lastOpenAt: Date | string | null,
  nowMs: number = Date.now()
): PassiveTier {
  const within = (d: Date | string | null) => {
    if (!d) return false;
    const t = new Date(d).getTime();
    return !isNaN(t) && nowMs - t <= WINDOW_MS;
  };
  if (within(lastClickAt)) return "Clicker";
  if (within(lastOpenAt)) return "Opener";
  // Has been emailed/engaged at some point but nothing recent → Cold.
  if ((emailClicks ?? 0) > 0 || lastOpenAt || lastClickAt) return "Cold";
  return null; // no email data
}

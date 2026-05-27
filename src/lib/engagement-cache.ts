import { unstable_cache } from "next/cache";
import { computeEngagement, type EngagementResult } from "./engagement";

export const ENGAGEMENT_TAG = "engagement";

/**
 * Cached wrapper around computeEngagement. Keyed by window length, tagged
 * so the "Refresh now" button can bust every window at once via
 * revalidateTag(ENGAGEMENT_TAG). 5-minute auto-revalidate otherwise.
 */
export function getEngagement(days: number): Promise<EngagementResult> {
  const cached = unstable_cache(
    () => computeEngagement({ sinceDays: days }),
    ["engagement", String(days)],
    { revalidate: 300, tags: [ENGAGEMENT_TAG] }
  );
  return cached();
}

export const WINDOWS = [
  { days: 30, label: "30d" },
  { days: 90, label: "90d" },
  { days: 180, label: "180d" },
  { days: 9999, label: "All" },
] as const;

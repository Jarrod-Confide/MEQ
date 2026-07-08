import { unstable_cache } from "next/cache";
import { computeEngagement, type EngagementResult } from "./engagement";

export const ENGAGEMENT_TAG = "engagement";

/**
 * Cache key version. Vercel's Data Cache persists ACROSS deployments, so a
 * deploy that changes the shape of EngagementResult/MemberScore (e.g. adding
 * a dimension) would otherwise serve stale, wrong-shaped objects to the new
 * code for up to `revalidate` seconds — a brief post-deploy outage.
 * BUMP THIS whenever the engagement data shape changes. (v3 = member
 * referrals feed Connector at weight 0.10, signals add `referrals`.)
 */
export const ENGAGEMENT_CACHE_VERSION = "v3-referrals-2026-07-07";

/**
 * Cached wrapper around computeEngagement. Keyed by version + window length,
 * tagged so the "Refresh now" button can bust every window at once via
 * revalidateTag(ENGAGEMENT_TAG). 5-minute auto-revalidate otherwise.
 */
export function getEngagement(days: number): Promise<EngagementResult> {
  const cached = unstable_cache(
    () => computeEngagement({ sinceDays: days }),
    ["engagement", ENGAGEMENT_CACHE_VERSION, String(days)],
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

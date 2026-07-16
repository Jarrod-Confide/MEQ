"use server";

import { revalidateTag } from "next/cache";
import { ENGAGEMENT_TAG } from "@/lib/engagement-cache";
import { computeAndStoreEngagement, ENGAGEMENT_WINDOWS } from "@/lib/engagement-store";

/**
 * "Refresh now" — recompute the materialized leaderboard for every window
 * (sequential, ~1–2s each), then bust the Data Cache so pages re-read it.
 * This is the only request-path entry point that runs the heavy compute,
 * and it's a single deliberate click, not a navigation stampede.
 */
export async function refreshEngagement() {
  for (const days of ENGAGEMENT_WINDOWS) {
    await computeAndStoreEngagement(days);
  }
  revalidateTag(ENGAGEMENT_TAG);
}

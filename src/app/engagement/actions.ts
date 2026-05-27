"use server";

import { revalidateTag } from "next/cache";
import { ENGAGEMENT_TAG } from "@/lib/engagement-cache";

export async function refreshEngagement() {
  revalidateTag(ENGAGEMENT_TAG);
}

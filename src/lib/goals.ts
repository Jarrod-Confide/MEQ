import type { Territory } from "./territory";

export type GoalKey = "quality" | "engagementLift" | "reactivation" | "events" | "newActivation";

export const GOAL_DEFS: { key: GoalKey; label: string; unit: string; description: string }[] = [
  { key: "engagementLift", label: "Engagement lift", unit: "Active+ members", description: "Members at Champion/Active tier (grow it)." },
  { key: "reactivation", label: "Reactivation", unit: "members", description: "Members who were Dormant last quarter and are now Active+." },
  { key: "events", label: "Event attendance", unit: "attendees", description: "Members who've attended an event (rolling 90d)." },
  { key: "newActivation", label: "New-member activation", unit: "activated", description: "Recently-joined members who reached Active+." },
  { key: "quality", label: "Quality of membership", unit: "Platinum/Gold", description: "High-quality (Platinum + Gold) members in the territory." },
];

/**
 * Quarterly targets per CM territory. SEEDED PLACEHOLDERS — tune per CM once
 * baselines are agreed (a goal-setting UI is a later step). INTL has no CM.
 */
export const TERRITORY_GOALS: Record<Territory, Record<GoalKey, number>> = {
  NE: { engagementLift: 110, reactivation: 15, events: 60, newActivation: 25, quality: 90 },
  SE: { engagementLift: 120, reactivation: 15, events: 60, newActivation: 25, quality: 100 },
  NW: { engagementLift: 25, reactivation: 6, events: 20, newActivation: 8, quality: 20 },
  SW: { engagementLift: 45, reactivation: 8, events: 30, newActivation: 12, quality: 40 },
  INTL: { engagementLift: 0, reactivation: 0, events: 0, newActivation: 0, quality: 0 },
};

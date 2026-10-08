import { CITY_GEO } from "./cities";
import { regionFromState, territoryFromCity, type Territory } from "./territory";

/**
 * Performance goals: the pure rules behind the Dashboard, Events and Setup.
 * No database access here, so everything is unit-tested (performance.test.ts).
 *
 * MEQ tracks performance TOWARD goals. It does not calculate bonuses (Jarrod,
 * 2026-10-08): no formula, weights, combined score or dollars. Every goal is
 * a range: a goal and a stretch goal.
 */

// ─── Setup variables (stored in app_settings, edited at /admin/setup) ───────

/** A goal and its stretch goal. */
export type GoalRange = { goal: number; stretch: number };

/** City-size tier: events in a city with at least `minMembers` members. */
export type EventTier = GoalRange & { minMembers: number };

/** How an event type earns an attendance goal. */
export type EventTypeGoal =
  | { mode: "city" } // from the city-size tiers
  | ({ mode: "fixed" } & GoalRange) // same goal for every event of the type
  | { mode: "none" }; // tracked, no goal

export type EngagementMeasure = {
  /** Participation window. Must be one the engagement cache stores. */
  windowDays: 30 | 90 | 180;
  /** Do emoji reactions count as participating? */
  countReactions: boolean;
  /** Does attending a virtual event count as participating? */
  countVirtual: boolean;
  /** Share of members participating, in percent. null = not set yet. */
  goalPct: number | null;
  stretchPct: number | null;
};

/** Engagement-score knobs read by the refresh cron (computeEngagement). */
export type ScoringSettings = {
  /** A virtual event's weight as a % of an in-person event (Jarrod 2026-10-08: virtual counts, in-person more). */
  virtualEventPct: number;
};

export type PerformanceSettings = {
  eventTiers: EventTier[];
  eventTypeGoals: Record<string, EventTypeGoal>; // keyed by EventFlow event_types.slug
  engagement: EngagementMeasure;
  scoring: ScoringSettings;
};

/**
 * Defaults. Goals are the v2 plan's (under 30 members → 10 attendees, 30–50 →
 * 15, 51–99 → 20, 100+ → 25). Stretch goals are PLACEHOLDERS (goal + 25%,
 * rounded up) until the team sets them in Setup.
 */
export const DEFAULT_SETTINGS: PerformanceSettings = {
  eventTiers: [
    { minMembers: 0, goal: 10, stretch: 13 },
    { minMembers: 30, goal: 15, stretch: 19 },
    { minMembers: 51, goal: 20, stretch: 25 },
    { minMembers: 100, goal: 25, stretch: 32 },
  ],
  eventTypeGoals: { dinner: { mode: "city" } },
  engagement: { windowDays: 90, countReactions: false, countVirtual: true, goalPct: null, stretchPct: null },
  scoring: { virtualEventPct: 50 },
};

export const SETTINGS_KEYS = ["eventTiers", "eventTypeGoals", "engagement", "scoring"] as const;
export type SettingsKey = (typeof SETTINGS_KEYS)[number];

/** Merge stored values over the defaults, ignoring anything malformed. */
export function resolveSettings(stored: Partial<Record<string, unknown>>): PerformanceSettings {
  const out: PerformanceSettings = structuredClone(DEFAULT_SETTINGS);
  const tiers = stored.eventTiers;
  if (Array.isArray(tiers) && tiers.length && tiers.every(isTier)) {
    out.eventTiers = [...tiers].sort((a, b) => a.minMembers - b.minMembers);
  }
  const types = stored.eventTypeGoals;
  if (types && typeof types === "object" && !Array.isArray(types)) {
    const clean: Record<string, EventTypeGoal> = {};
    for (const [slug, g] of Object.entries(types as Record<string, unknown>)) {
      if (isTypeGoal(g)) clean[slug] = g;
    }
    out.eventTypeGoals = clean;
  }
  const eng = stored.engagement as Partial<EngagementMeasure> | undefined;
  if (eng && typeof eng === "object") {
    if (eng.windowDays === 30 || eng.windowDays === 90 || eng.windowDays === 180) {
      out.engagement.windowDays = eng.windowDays;
    }
    if (typeof eng.countReactions === "boolean") out.engagement.countReactions = eng.countReactions;
    if (typeof eng.countVirtual === "boolean") out.engagement.countVirtual = eng.countVirtual;
    out.engagement.goalPct = numOrNull(eng.goalPct);
    out.engagement.stretchPct = numOrNull(eng.stretchPct);
  }
  const sc = stored.scoring as Partial<ScoringSettings> | undefined;
  const v = sc?.virtualEventPct;
  if (typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 200) out.scoring.virtualEventPct = v;
  return out;
}

function isTier(t: unknown): t is EventTier {
  const x = t as EventTier;
  return !!x && [x.minMembers, x.goal, x.stretch].every((n) => Number.isFinite(n) && n >= 0);
}
function isTypeGoal(g: unknown): g is EventTypeGoal {
  const x = g as { mode?: string; goal?: number; stretch?: number };
  if (!x || typeof x !== "object") return false;
  if (x.mode === "city" || x.mode === "none") return true;
  return x.mode === "fixed" && Number.isFinite(x.goal) && Number.isFinite(x.stretch);
}
function numOrNull(n: unknown): number | null {
  return typeof n === "number" && Number.isFinite(n) ? n : null;
}

// ─── Periods ────────────────────────────────────────────────────────────────

export type Period = { kind: "quarter" | "year"; label: string; start: Date; end: Date };

/** Calendar quarter containing `d` (UTC). end is exclusive. */
export function quarterOf(d: Date): Period {
  const y = d.getUTCFullYear();
  const q = Math.floor(d.getUTCMonth() / 3);
  return {
    kind: "quarter",
    label: `Q${q + 1} ${y}`,
    start: new Date(Date.UTC(y, q * 3, 1)),
    end: new Date(Date.UTC(y, q * 3 + 3, 1)),
  };
}

export function yearOf(d: Date): Period {
  const y = d.getUTCFullYear();
  return { kind: "year", label: String(y), start: new Date(Date.UTC(y, 0, 1)), end: new Date(Date.UTC(y + 1, 0, 1)) };
}

/** The `n` quarters ending with the one containing `d`, oldest first. */
export function lastQuarters(d: Date, n: number): Period[] {
  const out: Period[] = [];
  let cur = quarterOf(d);
  for (let i = 0; i < n; i++) {
    out.unshift(cur);
    cur = quarterOf(new Date(cur.start.getTime() - 86400000));
  }
  return out;
}

export function inPeriod(d: Date | string, p: Period): boolean {
  const t = new Date(d).getTime();
  return t >= p.start.getTime() && t < p.end.getTime();
}

/** Monday 00:00 UTC of each week from `start` (inclusive) to `end` (exclusive). */
export function weeksIn(start: Date, end: Date): Date[] {
  const first = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()));
  first.setUTCDate(first.getUTCDate() - ((first.getUTCDay() + 6) % 7));
  const out: Date[] = [];
  for (let t = first.getTime(); t < end.getTime(); t += 7 * 86400000) out.push(new Date(t));
  return out;
}

// ─── Events ─────────────────────────────────────────────────────────────────

/**
 * EventFlow event city → the Closest Major City value(s) members pick.
 * Most match exactly; these are the spellings that don't. A city listed with
 * several values (Bay Area) counts members of all of them.
 */
export const EVENT_CITY_ALIASES: Record<string, string[]> = {
  "New York": ["New York City"],
  "Washington, DC": ["Washington D.C."],
  "Washington DC": ["Washington D.C."],
  Raleigh: ["Raleigh-Durham"],
  "Bay Area": ["San Francisco", "San Jose"],
  "Newport Beach": ["Los Angeles"],
};

export function memberCitiesForEvent(city: string | null | undefined): string[] {
  const c = (city ?? "").trim();
  if (!c) return [];
  return EVENT_CITY_ALIASES[c] ?? [c];
}

const STATE_NAME_TO_CODE: Record<string, string> = {
  alabama: "AL", alaska: "AK", arizona: "AZ", arkansas: "AR", california: "CA", colorado: "CO",
  connecticut: "CT", delaware: "DE", "district of columbia": "DC", florida: "FL", georgia: "GA",
  hawaii: "HI", idaho: "ID", illinois: "IL", indiana: "IN", iowa: "IA", kansas: "KS", kentucky: "KY",
  louisiana: "LA", maine: "ME", maryland: "MD", massachusetts: "MA", michigan: "MI", minnesota: "MN",
  mississippi: "MS", missouri: "MO", montana: "MT", nebraska: "NE", nevada: "NV", "new hampshire": "NH",
  "new jersey": "NJ", "new mexico": "NM", "new york": "NY", "north carolina": "NC", "north dakota": "ND",
  ohio: "OH", oklahoma: "OK", oregon: "OR", pennsylvania: "PA", "rhode island": "RI",
  "south carolina": "SC", "south dakota": "SD", tennessee: "TN", texas: "TX", utah: "UT", vermont: "VT",
  virginia: "VA", washington: "WA", "west virginia": "WV", wisconsin: "WI", wyoming: "WY",
  "british columbia": "BC", alberta: "AB",
};

/** Region of an event: via its city (as members name it), else its state. */
export function eventRegion(city: string | null | undefined, state: string | null | undefined): Territory {
  for (const c of memberCitiesForEvent(city)) {
    if (CITY_GEO[c]) return territoryFromCity(c);
  }
  const s = (state ?? "").trim();
  if (!s) return "OTHER";
  return regionFromState(s.length === 2 ? s : STATE_NAME_TO_CODE[s.toLowerCase()]);
}

/** Goal range for an event from its type's rule and its city's member count. */
export function eventGoal(
  typeSlug: string | null,
  membersInCity: number,
  settings: PerformanceSettings
): GoalRange | null {
  const rule = typeSlug ? settings.eventTypeGoals[typeSlug] : undefined;
  if (!rule || rule.mode === "none") return null;
  if (rule.mode === "fixed") return { goal: rule.goal, stretch: rule.stretch };
  let tier: EventTier | null = null;
  for (const t of settings.eventTiers) if (membersInCity >= t.minMembers) tier = t;
  return tier ? { goal: tier.goal, stretch: tier.stretch } : null;
}

/**
 * Active practitioner: a practicing security leader. Everyone else is
 * excluded: sponsors and vendors (HubSpot sponsor flag or sponsor_rep role)
 * and Confide staff (confide_team role or a staff email domain).
 */
export function isActivePractitioner(c: {
  email: string | null;
  hubspotSponsor: boolean;
  roles: string[];
}): boolean {
  if (c.hubspotSponsor) return false;
  if (c.roles.includes("sponsor_rep") || c.roles.includes("confide_team")) return false;
  const domain = c.email?.split("@").pop()?.toLowerCase();
  return !(domain === "confide.group" || domain === "thecisosociety.com");
}

// ─── Progress ───────────────────────────────────────────────────────────────

/** Actual as a percentage of a target (rounded), or null without a target. */
export function pctOf(actual: number, target: number | null | undefined): number | null {
  if (!target || target <= 0) return null;
  return Math.round((actual / target) * 100);
}

export type GoalStatus = "stretch" | "met" | "below" | "none";

export function goalStatus(actual: number, range: GoalRange | null): GoalStatus {
  if (!range || range.goal <= 0) return "none";
  if (actual >= range.stretch) return "stretch";
  if (actual >= range.goal) return "met";
  return "below";
}

/** Sum goal ranges (null entries have no goal and are skipped). */
export function sumRanges(ranges: (GoalRange | null)[]): GoalRange {
  return ranges.reduce<GoalRange>(
    (acc, r) => (r ? { goal: acc.goal + r.goal, stretch: acc.stretch + r.stretch } : acc),
    { goal: 0, stretch: 0 }
  );
}

// ─── Engagement measure ─────────────────────────────────────────────────────

/** Activity counts as stored per member (engagement SignalCounts). */
export type ParticipationSignals = {
  posts?: number;
  replies?: number;
  eventsAttended?: number; // live (in-person) events
  virtualAttended?: number;
  reactionsGiven?: number;
};

/**
 * Did this member participate in the window? An event (live, or virtual if
 * Setup says so), a Slack or Circle post or reply, and (if Setup says so)
 * reactions. Circle visits join once Circle logins are captured (MQ-11).
 */
export function participated(s: ParticipationSignals | null | undefined, m: EngagementMeasure): boolean {
  if (!s) return false;
  if ((s.eventsAttended ?? 0) > 0) return true;
  if (m.countVirtual && (s.virtualAttended ?? 0) > 0) return true;
  if ((s.posts ?? 0) + (s.replies ?? 0) > 0) return true;
  return m.countReactions && (s.reactionsGiven ?? 0) > 0;
}

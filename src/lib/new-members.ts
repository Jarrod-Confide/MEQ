/**
 * New-member analytics: pure helpers (tested in new-members.test.ts).
 * Joins are counted by `members.joined_at`: the day a member became Active
 * in HubSpot (the working definition of "onboarded", 2026-10-08).
 */

export type Grain = "day" | "week" | "month" | "quarter";
export const GRAINS: Grain[] = ["day", "week", "month", "quarter"];

/** Start of the bucket containing `d` (UTC). Weeks start Monday. */
export function bucketStart(d: Date, grain: Grain): Date {
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  if (grain === "quarter") return new Date(Date.UTC(y, m - (m % 3), 1));
  if (grain === "month") return new Date(Date.UTC(y, m, 1));
  const day = new Date(Date.UTC(y, m, d.getUTCDate()));
  if (grain === "week") day.setUTCDate(day.getUTCDate() - ((day.getUTCDay() + 6) % 7));
  return day;
}

function nextBucket(d: Date, grain: Grain): Date {
  const x = new Date(d);
  if (grain === "day") x.setUTCDate(x.getUTCDate() + 1);
  else if (grain === "week") x.setUTCDate(x.getUTCDate() + 7);
  else if (grain === "month") x.setUTCMonth(x.getUTCMonth() + 1);
  else x.setUTCMonth(x.getUTCMonth() + 3);
  return x;
}

export function bucketLabel(d: Date, grain: Grain): string {
  const mon = d.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" });
  const yy = String(d.getUTCFullYear()).slice(2);
  if (grain === "quarter") return `Q${Math.floor(d.getUTCMonth() / 3) + 1} ${d.getUTCFullYear()}`;
  if (grain === "month") return `${mon} ${yy}`;
  return `${mon} ${d.getUTCDate()}`;
}

/** Count joins per bucket from `from` to `to` (inclusive), zero-filled. */
export function bucketJoins(
  joins: Date[],
  from: Date,
  to: Date,
  grain: Grain
): { start: Date; label: string; count: number }[] {
  const out: { start: Date; label: string; count: number }[] = [];
  const index = new Map<number, number>();
  for (let b = bucketStart(from, grain); b.getTime() <= to.getTime(); b = nextBucket(b, grain)) {
    index.set(b.getTime(), out.length);
    out.push({ start: b, label: bucketLabel(b, grain), count: 0 });
  }
  const end = to.getTime() + 86400000; // `to` is a whole day
  for (const j of joins) {
    const t = j.getTime();
    if (t < from.getTime() || t >= end) continue;
    const i = index.get(bucketStart(j, grain).getTime());
    if (i !== undefined) out[i].count++;
  }
  return out;
}

/** A sensible default grain for a range, so a chart has 8 to ~60 bars. */
export function defaultGrain(from: Date, to: Date): Grain {
  const days = (to.getTime() - from.getTime()) / 86400000;
  if (days <= 45) return "day";
  if (days <= 200) return "week";
  if (days <= 1100) return "month";
  return "quarter";
}

// ─── Time to first engagement ───────────────────────────────────────────────

export type Channel = "event" | "virtual" | "post" | "reaction";
export const CHANNELS: { key: Channel; label: string }[] = [
  { key: "event", label: "In-person event" },
  { key: "virtual", label: "Virtual event" },
  { key: "post", label: "Slack/Circle post or reply" },
  { key: "reaction", label: "Reaction" },
];
export const DEFAULT_CHANNELS: Channel[] = ["event", "virtual", "post"];

export type Milestones = {
  joinedAt: string;
  firstEventAt: string | null;
  firstVirtualAt: string | null;
  firstPostAt: string | null;
  firstReactionAt: string | null;
};

/** First engagement under the chosen definition, or null if none yet. */
export function firstEngagement(m: Milestones, channels: Channel[]): string | null {
  const dates = [
    channels.includes("event") ? m.firstEventAt : null,
    channels.includes("virtual") ? m.firstVirtualAt : null,
    channels.includes("post") ? m.firstPostAt : null,
    channels.includes("reaction") ? m.firstReactionAt : null,
  ].filter((d): d is string => !!d);
  if (!dates.length) return null;
  return dates.reduce((a, b) => (a < b ? a : b));
}

/** Whole days from joining to first engagement (0 = the same day). */
export function daysToEngage(joinedAt: string, engagedAt: string): number {
  const j = Date.UTC(...ymd(joinedAt));
  const e = Date.UTC(...ymd(engagedAt));
  return Math.max(0, Math.round((e - j) / 86400000));
}
function ymd(iso: string): [number, number, number] {
  const d = new Date(iso);
  return [d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()];
}

export function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

export const ENGAGE_BANDS = [
  { label: "Same week", max: 7 },
  { label: "8 to 30 days", max: 30 },
  { label: "31 to 60 days", max: 60 },
  { label: "61 to 90 days", max: 90 },
  { label: "After 90 days", max: Infinity },
] as const;

/** Earliest date in a sorted (ascending) ISO list on or after the join day. */
export function firstOnOrAfterJoin(sortedIsoDates: string[] | undefined, joinedAt: string): string | null {
  if (!sortedIsoDates?.length) return null;
  const j = new Date(joinedAt);
  const dayStart = Date.UTC(j.getUTCFullYear(), j.getUTCMonth(), j.getUTCDate());
  for (const d of sortedIsoDates) if (new Date(d).getTime() >= dayStart) return d;
  return null;
}

import { describe, expect, it } from "vitest";
import {
  DEFAULT_SETTINGS,
  eventGoal,
  eventRegion,
  goalStatus,
  isActivePractitioner,
  lastQuarters,
  memberCitiesForEvent,
  participated,
  pctOf,
  quarterOf,
  resolveSettings,
  sumRanges,
  weeksIn,
  yearOf,
} from "./performance";

describe("event goals from city size (v2 plan)", () => {
  const goal = (members: number) => eventGoal("dinner", members, DEFAULT_SETTINGS)?.goal;
  it("follows the plan's tiers", () => {
    expect(goal(0)).toBe(10);
    expect(goal(29)).toBe(10);
    expect(goal(30)).toBe(15);
    expect(goal(50)).toBe(15);
    expect(goal(51)).toBe(20);
    expect(goal(99)).toBe(20);
    expect(goal(100)).toBe(25);
    expect(goal(400)).toBe(25);
  });
  it("every tier has a stretch at least its goal", () => {
    for (const t of DEFAULT_SETTINGS.eventTiers) expect(t.stretch).toBeGreaterThanOrEqual(t.goal);
  });
  it("types without a rule, or set to none, have no goal", () => {
    expect(eventGoal("anti-summit", 120, DEFAULT_SETTINGS)).toBeNull();
    expect(eventGoal(null, 120, DEFAULT_SETTINGS)).toBeNull();
    const s = { ...DEFAULT_SETTINGS, eventTypeGoals: { dinner: { mode: "none" as const } } };
    expect(eventGoal("dinner", 120, s)).toBeNull();
  });
  it("fixed goals ignore city size", () => {
    const s = { ...DEFAULT_SETTINGS, eventTypeGoals: { "anti-summit": { mode: "fixed" as const, goal: 50, stretch: 60 } } };
    expect(eventGoal("anti-summit", 3, s)).toEqual({ goal: 50, stretch: 60 });
  });
});

describe("resolveSettings", () => {
  it("falls back to defaults for missing or malformed values", () => {
    expect(resolveSettings({})).toEqual(DEFAULT_SETTINGS);
    expect(resolveSettings({ eventTiers: [{ minMembers: "x" }], engagement: { windowDays: 45 } })).toEqual(DEFAULT_SETTINGS);
  });
  it("keeps valid stored values and sorts tiers", () => {
    const s = resolveSettings({
      eventTiers: [
        { minMembers: 40, goal: 18, stretch: 22 },
        { minMembers: 0, goal: 8, stretch: 10 },
      ],
      eventTypeGoals: { dinner: { mode: "city" }, bogus: { mode: "fixed" } },
      engagement: { windowDays: 30, countReactions: true, goalPct: 40, stretchPct: 50 },
    });
    expect(s.eventTiers.map((t) => t.minMembers)).toEqual([0, 40]);
    expect(s.eventTypeGoals).toEqual({ dinner: { mode: "city" } });
    expect(s.engagement).toEqual({ windowDays: 30, countReactions: true, countVirtual: true, goalPct: 40, stretchPct: 50 });
  });
});

describe("event cities and regions", () => {
  it("maps EventFlow spellings to members' Closest Major City", () => {
    expect(memberCitiesForEvent("New York")).toEqual(["New York City"]);
    expect(memberCitiesForEvent("Washington, DC")).toEqual(["Washington D.C."]);
    expect(memberCitiesForEvent("Bay Area")).toEqual(["San Francisco", "San Jose"]);
    expect(memberCitiesForEvent(" Boston ")).toEqual(["Boston"]);
    expect(memberCitiesForEvent("")).toEqual([]);
  });
  it("places events in the CM regions", () => {
    expect(eventRegion("Boston", "Massachusetts")).toBe("NE");
    expect(eventRegion("Columbus", "Ohio")).toBe("NE");
    expect(eventRegion("Dallas", "Texas")).toBe("CENTRAL");
    expect(eventRegion("Bay Area", "California")).toBe("WEST");
    expect(eventRegion("Nashville", "Tennessee")).toBe("SE");
    expect(eventRegion("New York", "New York")).toBe("NE");
    expect(eventRegion("Washington, DC", null)).toBe("NE");
    expect(eventRegion("London, UK", null)).toBe("OTHER");
    expect(eventRegion("Toronto", "Ontario")).toBe("OTHER");
  });
  it("falls back to the state for cities members don't pick", () => {
    expect(eventRegion("Somewhereville", "Georgia")).toBe("SE");
    expect(eventRegion("Somewhereville", "CA")).toBe("WEST");
    expect(eventRegion("Somewhereville", "Mexico")).toBe("OTHER");
  });
});

describe("active practitioner", () => {
  const base = { email: "ciso@bank.com", hubspotSponsor: false, roles: [] as string[] };
  it("counts practicing security leaders", () => expect(isActivePractitioner(base)).toBe(true));
  it("excludes sponsors and vendors", () => {
    expect(isActivePractitioner({ ...base, hubspotSponsor: true })).toBe(false);
    expect(isActivePractitioner({ ...base, roles: ["sponsor_rep"] })).toBe(false);
  });
  it("excludes Confide staff", () => {
    expect(isActivePractitioner({ ...base, roles: ["confide_team"] })).toBe(false);
    expect(isActivePractitioner({ ...base, email: "someone@confide.group" })).toBe(false);
    expect(isActivePractitioner({ ...base, email: "someone@TheCISOSociety.com" })).toBe(false);
  });
  it("hosts and speakers still count", () => expect(isActivePractitioner({ ...base, roles: ["host", "speaker"] })).toBe(true));
});

describe("periods", () => {
  it("finds the calendar quarter and year (UTC)", () => {
    const q = quarterOf(new Date("2026-10-08T12:00:00Z"));
    expect(q.label).toBe("Q4 2026");
    expect(q.start.toISOString()).toBe("2026-10-01T00:00:00.000Z");
    expect(q.end.toISOString()).toBe("2027-01-01T00:00:00.000Z");
    expect(yearOf(new Date("2026-10-08T00:00:00Z")).label).toBe("2026");
  });
  it("lists recent quarters oldest first, across a year boundary", () => {
    expect(lastQuarters(new Date("2027-02-01T00:00:00Z"), 3).map((p) => p.label)).toEqual(["Q3 2026", "Q4 2026", "Q1 2027"]);
  });
  it("weeks start on Monday", () => {
    const w = weeksIn(new Date("2026-10-01T00:00:00Z"), new Date("2026-10-20T00:00:00Z"));
    expect(w.map((d) => d.toISOString().slice(0, 10))).toEqual(["2026-09-28", "2026-10-05", "2026-10-12", "2026-10-19"]);
  });
});

describe("progress", () => {
  it("rates against goal and stretch", () => {
    expect(goalStatus(9, { goal: 10, stretch: 13 })).toBe("below");
    expect(goalStatus(10, { goal: 10, stretch: 13 })).toBe("met");
    expect(goalStatus(13, { goal: 10, stretch: 13 })).toBe("stretch");
    expect(goalStatus(5, null)).toBe("none");
  });
  it("percent of goal, uncapped", () => {
    expect(pctOf(11, 10)).toBe(110);
    expect(pctOf(3, 0)).toBeNull();
  });
  it("sums ranges, skipping events without goals", () => {
    expect(sumRanges([{ goal: 10, stretch: 13 }, null, { goal: 15, stretch: 19 }])).toEqual({ goal: 25, stretch: 32 });
  });
});

describe("engagement participation", () => {
  const m = DEFAULT_SETTINGS.engagement;
  it("live events, posts and replies count", () => {
    expect(participated({ eventsAttended: 1 }, m)).toBe(true);
    expect(participated({ posts: 1 }, m)).toBe(true);
    expect(participated({ replies: 2 }, m)).toBe(true);
  });
  it("virtual events count unless Setup turns them off", () => {
    expect(participated({ virtualAttended: 1 }, m)).toBe(true);
    expect(participated({ virtualAttended: 1 }, { ...m, countVirtual: false })).toBe(false);
  });
  it("scoring settings: virtual weight defaults to half, bad values ignored", () => {
    expect(DEFAULT_SETTINGS.scoring.virtualEventPct).toBe(50);
    expect(resolveSettings({ scoring: { virtualEventPct: 75 } }).scoring.virtualEventPct).toBe(75);
    expect(resolveSettings({ scoring: { virtualEventPct: -1 } }).scoring.virtualEventPct).toBe(50);
  });
  it("reactions count only when Setup says so", () => {
    expect(participated({ reactionsGiven: 4 }, m)).toBe(false);
    expect(participated({ reactionsGiven: 4 }, { ...m, countReactions: true })).toBe(true);
  });
  it("nothing, or no record, is not participating", () => {
    expect(participated({}, m)).toBe(false);
    expect(participated(null, m)).toBe(false);
  });
});

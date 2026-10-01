import { describe, expect, it } from "vitest";
import { DIMENSION_WEIGHTS, WEIGHTS } from "./engagement";
import { computeQuality, QUALITY_WEIGHTS } from "./quality-score";
import { passiveTier } from "./passive";
import { assessFreshness } from "./freshness";

const sum = (o: Record<string, number>) => Object.values(o).reduce((s, n) => s + n, 0);

describe("engagement weights", () => {
  it("dimension weights sum to 1", () => {
    expect(sum(DIMENSION_WEIGHTS)).toBeCloseTo(1, 10);
  });
  it("gives connector its agreed 10% (referrals)", () => {
    expect(DIMENSION_WEIGHTS.connector).toBe(0.1);
  });
  it("makes a referral outweigh any single connector message (content weight caps at 3)", () => {
    expect(WEIGHTS.referral).toBeGreaterThan(3);
  });
});

describe("quality score", () => {
  const base = {
    companySize: null,
    isFortune2000: false,
    seniority: null,
    reportingTo: null,
    teamSize: null,
    employmentType: null,
  };

  it("weights sum to 1", () => {
    expect(sum(QUALITY_WEIGHTS)).toBeCloseTo(1, 10);
  });

  it("scores a top-tier member Platinum", () => {
    const q = computeQuality({
      companySize: "10,000+",
      isFortune2000: true,
      seniority: "C-Level",
      reportingTo: "CEO",
      teamSize: "100+",
      employmentType: "employed",
    });
    expect(q.tier).toBe("Platinum");
    expect(q.score).toBeGreaterThanOrEqual(80);
  });

  it("treats missing CRM data as neutral employment, not zero", () => {
    expect(computeQuality(base).employment).toBe(50);
  });

  it("floors prominence high for Fortune 2000 regardless of size", () => {
    expect(computeQuality({ ...base, companySize: "1-200", isFortune2000: true }).prominence).toBe(90);
  });

  it("maps score bands to tiers at the documented cut-offs", () => {
    const tierAt = (target: number) => {
      // Search the input space for a member whose score lands on target.
      for (const size of ["10,000+", "1,001-5,000", "201-500", "1-200", null]) {
        for (const sen of ["C-Level", "director", "manager", null]) {
          for (const team of ["100+", "16-30", "1-5", null]) {
            const q = computeQuality({ ...base, companySize: size, seniority: sen, teamSize: team, employmentType: "employed" });
            if (q.score === target) return q.tier;
          }
        }
      }
      return undefined;
    };
    // Any score found must sit in the right band.
    for (const [lo, tier] of [[80, "Platinum"], [60, "Gold"], [40, "Silver"], [20, "Bronze"]] as const) {
      const t = tierAt(lo);
      if (t) expect(t).toBe(tier);
    }
    expect(computeQuality({ ...base, employmentType: "in_transition" }).tier).toBe("Unranked");
  });
});

describe("passive email tier", () => {
  const now = Date.parse("2026-10-01T00:00:00Z");
  const daysAgo = (d: number) => new Date(now - d * 86400000);

  it("Clicker when clicked within 90 days", () => {
    expect(passiveTier(3, daysAgo(10), daysAgo(1), now)).toBe("Clicker");
  });
  it("Opener when only opened within 90 days (opens are weak: Apple MPP)", () => {
    expect(passiveTier(0, null, daysAgo(5), now)).toBe("Opener");
  });
  it("Cold when activity is older than 90 days", () => {
    expect(passiveTier(2, daysAgo(200), daysAgo(150), now)).toBe("Cold");
  });
  it("null when there is no email data", () => {
    expect(passiveTier(null, null, null, now)).toBeNull();
  });
});

describe("data freshness (feeds /api/health → Heartbeat)", () => {
  const now = new Date("2026-10-01T12:00:00Z");
  const minsAgo = (m: number) => new Date(now.getTime() - m * 60000);

  it("is healthy when every job ran on schedule", () => {
    const f = assessFreshness(
      { engagementComputedAt: minsAgo(9), lastSyncOkAt: minsAgo(6 * 60), latestSnapshotWeek: minsAgo(3 * 24 * 60) },
      now
    );
    expect([f.engagement.status, f.sync.status, f.snapshot.status]).toEqual(["ok", "ok", "ok"]);
  });

  it("tolerates a few missed engagement refreshes, then alarms", () => {
    expect(assessFreshness({ engagementComputedAt: minsAgo(40), lastSyncOkAt: now, latestSnapshotWeek: now }, now).engagement.status).toBe("ok");
    expect(assessFreshness({ engagementComputedAt: minsAgo(50), lastSyncOkAt: now, latestSnapshotWeek: now }, now).engagement.status).toBe("stale");
  });

  it("alarms when the daily sync misses a whole day", () => {
    expect(assessFreshness({ engagementComputedAt: now, lastSyncOkAt: minsAgo(27 * 60), latestSnapshotWeek: now }, now).sync.status).toBe("stale");
  });

  it("does not alarm on Monday morning before the weekly snapshot runs", () => {
    // Monday 06:00 UTC: latest week_start is the previous Monday, 7 days 6 hours ago.
    const monday6am = new Date("2026-10-05T06:00:00Z");
    const f = assessFreshness(
      { engagementComputedAt: monday6am, lastSyncOkAt: monday6am, latestSnapshotWeek: new Date("2026-09-28T00:00:00Z") },
      monday6am
    );
    expect(f.snapshot.status).toBe("ok");
  });

  it("treats a job that never ran as stale", () => {
    const f = assessFreshness({ engagementComputedAt: null, lastSyncOkAt: null, latestSnapshotWeek: null }, now);
    expect(f.engagement).toEqual({ status: "stale", ageMinutes: null });
  });
});

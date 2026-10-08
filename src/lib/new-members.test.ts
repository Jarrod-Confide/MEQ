import { describe, expect, it } from "vitest";
import {
  bucketJoins,
  bucketStart,
  daysToEngage,
  defaultGrain,
  firstEngagement,
  firstOnOrAfterJoin,
  median,
  type Milestones,
} from "./new-members";

const d = (s: string) => new Date(`${s}T12:00:00Z`);

describe("buckets", () => {
  it("starts weeks on Monday, months and quarters on the 1st", () => {
    expect(bucketStart(d("2026-10-08"), "week").toISOString().slice(0, 10)).toBe("2026-10-05");
    expect(bucketStart(d("2026-10-08"), "month").toISOString().slice(0, 10)).toBe("2026-10-01");
    expect(bucketStart(d("2026-11-20"), "quarter").toISOString().slice(0, 10)).toBe("2026-10-01");
    expect(bucketStart(d("2026-10-08"), "day").toISOString().slice(0, 10)).toBe("2026-10-08");
  });
  it("counts joins per bucket, zero-filled, inclusive of the last day", () => {
    const joins = [d("2026-09-01"), d("2026-09-30"), d("2026-10-31"), d("2026-11-01")];
    const b = bucketJoins(joins, new Date("2026-09-01T00:00:00Z"), new Date("2026-11-30T00:00:00Z"), "month");
    expect(b.map((x) => [x.label, x.count])).toEqual([["Sep 26", 2], ["Oct 26", 1], ["Nov 26", 1]]);
    const days = bucketJoins([d("2026-10-02")], new Date("2026-10-01T00:00:00Z"), new Date("2026-10-03T00:00:00Z"), "day");
    expect(days.map((x) => x.count)).toEqual([0, 1, 0]);
  });
  it("ignores joins outside the range", () => {
    const b = bucketJoins([d("2025-01-01")], new Date("2026-01-01T00:00:00Z"), new Date("2026-01-31T00:00:00Z"), "week");
    expect(b.reduce((s, x) => s + x.count, 0)).toBe(0);
  });
  it("picks a grain that keeps the chart readable", () => {
    expect(defaultGrain(d("2026-10-01"), d("2026-10-20"))).toBe("day");
    expect(defaultGrain(d("2026-07-01"), d("2026-10-01"))).toBe("week");
    expect(defaultGrain(d("2025-10-01"), d("2026-10-01"))).toBe("month");
    expect(defaultGrain(d("2020-01-01"), d("2026-10-01"))).toBe("quarter");
  });
});

describe("time to first engagement", () => {
  const m: Milestones = {
    joinedAt: "2026-09-01T15:00:00.000Z",
    firstEventAt: "2026-09-20T00:00:00.000Z",
    firstVirtualAt: "2026-09-10T00:00:00.000Z",
    firstPostAt: null,
    firstReactionAt: "2026-09-02T00:00:00.000Z",
  };
  it("uses only the chosen channels", () => {
    expect(firstEngagement(m, ["event"])).toBe(m.firstEventAt);
    expect(firstEngagement(m, ["event", "virtual"])).toBe(m.firstVirtualAt);
    expect(firstEngagement(m, ["event", "virtual", "reaction"])).toBe(m.firstReactionAt);
    expect(firstEngagement(m, ["post"])).toBeNull();
    expect(firstEngagement(m, [])).toBeNull();
  });
  it("counts whole days, same day = 0", () => {
    expect(daysToEngage(m.joinedAt, "2026-09-01T00:00:00.000Z")).toBe(0);
    expect(daysToEngage(m.joinedAt, m.firstEventAt!)).toBe(19);
  });
  it("only counts activity from the join day on", () => {
    const days = ["2026-08-15T00:00:00.000Z", "2026-09-01T00:00:00.000Z", "2026-09-05T00:00:00.000Z"];
    expect(firstOnOrAfterJoin(days, m.joinedAt)).toBe("2026-09-01T00:00:00.000Z");
    expect(firstOnOrAfterJoin(days.slice(0, 1), m.joinedAt)).toBeNull();
    expect(firstOnOrAfterJoin(undefined, m.joinedAt)).toBeNull();
  });
  it("median", () => {
    expect(median([5, 1, 3])).toBe(3);
    expect(median([4, 1, 3, 2])).toBe(2.5);
    expect(median([])).toBeNull();
  });
});

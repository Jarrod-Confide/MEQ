import { describe, expect, it } from "vitest";
import type { HubMember } from "./memberhub";
import { planMemberHubSync, type MeqMemberRow } from "./memberhub-match";

const hub = (n: number, over: Partial<HubMember> = {}): HubMember => ({
  member_number: n,
  status: "active",
  joined_at: "2026-01-10T00:00:00.000Z",
  first_name: "M",
  last_name: String(n),
  job_title: null,
  company: null,
  closest_major_city: "Boston",
  region: "NE",
  industry: null,
  company_size: null,
  accounts: { hubspot_contact_id: `hs${n}`, circle_member_id: null, slack_user_id: null },
  emails: [{ address: `m${n}@x.com`, kind: "work", status: "ok", purposes: ["login"] }],
  email_for: { login: `m${n}@x.com` },
  is_test: false,
  updated_at: "2026-10-15T00:00:00.000Z",
  ...over,
});
const row = (id: string, over: Partial<MeqMemberRow> = {}): MeqMemberRow => ({
  id,
  memberNumber: null,
  hubspotContactId: null,
  eventflowContactId: null,
  email: null,
  additionalEmails: [],
  isMember: true,
  closestMajorCity: "Boston",
  region: null,
  joinedAt: "2026-01-10T00:00:00.000Z",
  ...over,
});

describe("planMemberHubSync", () => {
  it("matches by member number, then HubSpot id, then email, then EventFlow", () => {
    const rows = [
      row("a", { memberNumber: 1 }),
      row("b", { hubspotContactId: "hs2" }),
      row("c", { email: "other@x.com", additionalEmails: ["m3@x.com"] }),
      row("d", { eventflowContactId: "ef4" }),
    ];
    const p = planMemberHubSync(rows, [hub(1), hub(2), hub(3), hub(4, { accounts: undefined, emails: [], email_for: { login: null } })], new Map([[4, "ef4"]]));
    expect(p.matched.map((m) => [m.rowId, m.by])).toEqual([
      ["a", "member_number"],
      ["b", "hubspot"],
      ["c", "email"],
      ["d", "eventflow"],
    ]);
    expect(p.counts.created).toBe(0);
    expect(p.leavers).toEqual([]);
  });
  it("resolves a merged member's old number through aliases", () => {
    const p = planMemberHubSync([row("a", { memberNumber: 7 })], [hub(9, { aliases: [7], accounts: undefined, emails: [] })], new Map());
    expect(p.matched[0]).toMatchObject({ rowId: "a", by: "member_number" });
  });
  it("creates rows for new members, with their EventFlow contact when known", () => {
    const p = planMemberHubSync([], [hub(5), hub(6)], new Map([[5, "ef5"]]));
    expect(p.created.map((c) => [c.hub.member_number, c.eventflowContactId])).toEqual([[5, "ef5"], [6, null]]);
    expect(p.counts.createdWithoutEventflowContact).toBe(1);
  });
  it("keeps leavers (marked, not deleted) and ignores non-active and test records", () => {
    const p = planMemberHubSync(
      [row("a", { memberNumber: 1 }), row("gone", { memberNumber: 2 }), row("old", { memberNumber: 3, isMember: false })],
      [hub(1), hub(2, { status: "former" }), hub(8, { is_test: true })],
      new Map()
    );
    expect(p.leavers.map((l) => l.id)).toEqual(["gone"]);
    expect(p.counts.created).toBe(0);
  });
  it("never lets two MemberHub members claim one MEQ row", () => {
    const p = planMemberHubSync([row("a", { email: "shared@x.com" })], [
      hub(1, { accounts: undefined, emails: [{ address: "shared@x.com", kind: "work", status: "ok", purposes: [] }] }),
      hub(2, { accounts: undefined, emails: [{ address: "shared@x.com", kind: "work", status: "ok", purposes: [] }] }),
    ], new Map());
    expect(p.matched).toHaveLength(1);
    expect(p.duplicates.map((d) => d.hub.member_number)).toEqual([2]);
  });
  it("reports region and join-date differences", () => {
    const p = planMemberHubSync(
      [row("a", { memberNumber: 1, closestMajorCity: "Boston" }), row("b", { memberNumber: 2, region: "WEST" })],
      [hub(1, { region: "CENTRAL" }), hub(2, { region: "WEST", joined_at: "2026-03-01T00:00:00.000Z" })],
      new Map()
    );
    expect(p.regionChanges.map((r) => [r.hub.member_number, r.from, r.to])).toEqual([[1, "NE", "CENTRAL"]]);
    expect(p.joinedChanges.map((j) => j.hub.member_number)).toEqual([2]);
  });
});

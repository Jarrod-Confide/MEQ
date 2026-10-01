import { describe, expect, it } from "vitest";
import { buildPersonIndex, canonical, classifyReferrer, normalizeName } from "./referral-matching";

const staff = [
  { id: "s-sean", name: "Sean Navarro", aliases: ["sean"] },
  { id: "s-larry", name: "Larry Whiteside", aliases: ["larry"] },
  { id: "s-george", name: "George Kamide", aliases: [] },
];
const members = [
  { id: "m-patricia", name: "Patricia Titus" },
  { id: "m-rick", name: "Rick Doten" },
  { id: "m-michael", name: "Michael Calvi" },
  { id: "m-parminder", name: "Parminder Sahi" },
  { id: "m-victor", name: "Victor Chang" },
  { id: "m-chris", name: "Chris Hallenbeck" },
  { id: "m-arpi", name: "Arpi Long" },
  { id: "m-bashir", name: "Brenda Bashir-Trout" },
  // Larry is on the roster AND on the staff list.
  { id: "m-larry", name: "Larry Whiteside" },
  // Duplicate contacts upstream: two roster rows, one person.
  { id: "m-carlos-1", name: "Carlos De Leon" },
  { id: "m-carlos-2", name: "Carlos De Leon" },
  { id: "m-dave", name: "Dave Mahon" },
  { id: "m-vlad", name: "Vlad Brodsky" },
  { id: "m-mono", name: "Cher" },
];
const index = buildPersonIndex(staff, members);
const classify = (raw: string) => classifyReferrer(raw, index);

describe("normalizeName", () => {
  it("lowercases, strips punctuation and suffixes, collapses spaces", () => {
    expect(normalizeName("  Larry  Whiteside Jr. ")).toBe("larry whiteside");
  });
  it("strips accents", () => {
    expect(normalizeName("Víctor Chang")).toBe("victor chang");
  });
  it("splits emails and hyphens into words", () => {
    expect(normalizeName("Chris.Hallenbeck@tanium.com")).toBe("chris hallenbeck tanium com");
    expect(normalizeName("Brenda Bashir-Trout")).toBe("brenda bashir trout");
  });
});

describe("canonical", () => {
  it("expands unambiguous nicknames only", () => {
    expect(canonical("mike calvi")).toBe("michael calvi");
    expect(canonical("rich doten")).toBe(canonical("rick doten"));
    expect(canonical("alex smith")).toBe("alex smith"); // Alexander or Alexandra: left alone
  });
});

describe("classifyReferrer", () => {
  it("matches a member by exact name", () => {
    expect(classify("Patricia Titus")).toMatchObject({ status: "member", referrerMemberId: "m-patricia" });
  });

  it("matches nicknames to the formal name", () => {
    expect(classify("Patti Titus")).toMatchObject({ status: "member", referrerMemberId: "m-patricia" });
    expect(classify("Mike Calvi")).toMatchObject({ status: "member", referrerMemberId: "m-michael" });
    expect(classify("Rich Doten")).toMatchObject({ status: "member", referrerMemberId: "m-rick" });
  });

  it("finds the name inside extra text, an email, or with accents", () => {
    expect(classify("Arpi Long, Deputy CISO at Collective Health")).toMatchObject({ referrerMemberId: "m-arpi" });
    expect(classify("chris.hallenbeck@tanium.com")).toMatchObject({ referrerMemberId: "m-chris" });
    expect(classify("Víctor Chang")).toMatchObject({ referrerMemberId: "m-victor" });
    expect(classify("Brenda Bashir-Trout")).toMatchObject({ referrerMemberId: "m-bashir" });
  });

  it("drops a middle name when the full answer has no match", () => {
    expect(classify("Parminder Singh Sahi")).toMatchObject({ status: "member", referrerMemberId: "m-parminder" });
  });

  // Regression (2026-10-01): staff missing from the registry were credited as
  // members. A staffer who is also on the roster must still count as staff.
  it("counts a staffer as staff even when they are also on the roster", () => {
    expect(classify("Larry Whiteside")).toMatchObject({ status: "staff", referrerStaffId: "s-larry", referrerMemberId: null });
    expect(classify("Larry Whiteside Jr.")).toMatchObject({ status: "staff", referrerStaffId: "s-larry" });
  });

  it("accepts single-word staff aliases only as the whole answer", () => {
    expect(classify("Sean")).toMatchObject({ status: "staff", referrerStaffId: "s-sean" });
    expect(classify("larry")).toMatchObject({ status: "staff", referrerStaffId: "s-larry" });
  });

  it("does not match a different person who shares a last name", () => {
    expect(classify("Steve Navarro").status).toBe("unmatched");
  });

  it("flags duplicate roster contacts as ambiguous instead of guessing", () => {
    expect(classify("Carlos De Leon")).toMatchObject({ status: "ambiguous", referrerMemberId: null });
  });

  it("leaves answers naming several people unmatched", () => {
    expect(classify("Dave Mahon; Vlad Brodsky").status).toBe("unmatched");
  });

  it("never matches a one-word roster name inside other text", () => {
    expect(classify("Cher").status).toBe("unmatched");
  });

  it("ignores answers that are not a person", () => {
    for (const raw of ["n/a", "N/A", "none", "LinkedIn", "Already a member", "The CISO Society", "Decided to apply on my own"]) {
      expect(classify(raw).status, raw).toBe("ignored");
    }
  });

  it("keeps unknown names in the unmatched queue", () => {
    expect(classify("Jane Nobody").status).toBe("unmatched");
  });
});

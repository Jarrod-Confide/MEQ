import type { HubMember } from "./memberhub";
import { territoryFromCity, type Territory } from "./territory";

/**
 * Plan the MemberHub → MEQ member sync without touching a database
 * (memberhub-match.test.ts). Rows are matched, never deleted and re-created:
 * deleting a members row cascades to quality, referrals and milestones.
 *
 * Match order for each MemberHub member: member number (or a merged alias),
 * HubSpot contact id, any email, then EventFlow's contact for that member
 * number. A MEQ row is claimed once; a second claim is reported as a duplicate.
 */

export type MeqMemberRow = {
  id: string;
  memberNumber: number | null;
  hubspotContactId: string | null;
  eventflowContactId: string | null;
  email: string | null;
  additionalEmails: string[] | null;
  isMember: boolean;
  closestMajorCity: string | null;
  region: string | null;
  joinedAt: string | null;
};

export type MatchedBy = "member_number" | "hubspot" | "email" | "eventflow";

export type SyncPlan = {
  matched: { hub: HubMember; rowId: string; by: MatchedBy }[];
  /** MemberHub members with no MEQ row (new rows; eventflow id when EventFlow has them). */
  created: { hub: HubMember; eventflowContactId: string | null }[];
  /** MEQ members no longer Active in MemberHub: kept, marked is_member = false. */
  leavers: MeqMemberRow[];
  /** A MEQ row two MemberHub members both matched (should be zero). */
  duplicates: { hub: HubMember; rowId: string }[];
  regionChanges: { hub: HubMember; from: Territory; to: Territory }[];
  /** Join dates more than a day apart (MEQ's came from HubSpot). */
  joinedChanges: { hub: HubMember; from: string | null; to: string | null }[];
  counts: Record<string, number>;
};

export function hubEmails(h: HubMember): string[] {
  const set = new Set<string>();
  if (h.email_for?.login) set.add(h.email_for.login.toLowerCase());
  for (const e of h.emails ?? []) if (e.address) set.add(e.address.toLowerCase());
  return [...set];
}

export function currentRegion(r: Pick<MeqMemberRow, "region" | "closestMajorCity">): Territory {
  return (r.region as Territory | null) ?? territoryFromCity(r.closestMajorCity);
}

const DAY = 86400000;

export function planMemberHubSync(
  rows: MeqMemberRow[],
  hub: HubMember[],
  eventflowByNumber: Map<number, string>
): SyncPlan {
  const byNumber = new Map<number, MeqMemberRow>();
  const byHubspot = new Map<string, MeqMemberRow>();
  const byEmail = new Map<string, MeqMemberRow>();
  const byEventflow = new Map<string, MeqMemberRow>();
  for (const r of rows) {
    if (r.memberNumber != null) byNumber.set(r.memberNumber, r);
    if (r.hubspotContactId) byHubspot.set(r.hubspotContactId, r);
    if (r.eventflowContactId) byEventflow.set(r.eventflowContactId, r);
    for (const e of [r.email, ...(r.additionalEmails ?? [])]) {
      if (e && !byEmail.has(e.toLowerCase())) byEmail.set(e.toLowerCase(), r);
    }
  }

  const claimed = new Set<string>();
  const plan: SyncPlan = { matched: [], created: [], leavers: [], duplicates: [], regionChanges: [], joinedChanges: [], counts: {} };

  for (const h of hub) {
    if (h.is_test || h.status !== "active") continue;
    let row: MeqMemberRow | undefined;
    let by: MatchedBy | undefined;
    for (const n of [h.member_number, ...(h.aliases ?? [])]) {
      row = byNumber.get(n);
      if (row) { by = "member_number"; break; }
    }
    if (!row && h.accounts?.hubspot_contact_id) {
      row = byHubspot.get(h.accounts.hubspot_contact_id);
      if (row) by = "hubspot";
    }
    if (!row) {
      for (const e of hubEmails(h)) {
        row = byEmail.get(e);
        if (row) { by = "email"; break; }
      }
    }
    const ef = eventflowByNumber.get(h.member_number) ?? null;
    if (!row && ef) {
      row = byEventflow.get(ef);
      if (row) by = "eventflow";
    }

    if (!row) {
      plan.created.push({ hub: h, eventflowContactId: ef });
      continue;
    }
    if (claimed.has(row.id)) {
      plan.duplicates.push({ hub: h, rowId: row.id });
      continue;
    }
    claimed.add(row.id);
    plan.matched.push({ hub: h, rowId: row.id, by: by! });

    const from = currentRegion(row);
    if (from !== h.region) plan.regionChanges.push({ hub: h, from, to: h.region });
    const a = row.joinedAt ? new Date(row.joinedAt).getTime() : null;
    const b = h.joined_at ? new Date(h.joined_at).getTime() : null;
    if ((a == null) !== (b == null) || (a != null && b != null && Math.abs(a - b) > DAY)) {
      plan.joinedChanges.push({ hub: h, from: row.joinedAt, to: h.joined_at });
    }
  }

  plan.leavers = rows.filter((r) => r.isMember && !claimed.has(r.id));
  const by = (k: MatchedBy) => plan.matched.filter((m) => m.by === k).length;
  plan.counts = {
    memberhubActive: hub.filter((h) => !h.is_test && h.status === "active").length,
    meqMembers: rows.filter((r) => r.isMember).length,
    matched: plan.matched.length,
    matchedByMemberNumber: by("member_number"),
    matchedByHubspot: by("hubspot"),
    matchedByEmail: by("email"),
    matchedByEventflow: by("eventflow"),
    created: plan.created.length,
    createdWithoutEventflowContact: plan.created.filter((c) => !c.eventflowContactId).length,
    leavers: plan.leavers.length,
    duplicates: plan.duplicates.length,
    regionChanges: plan.regionChanges.length,
    joinedDateChanges: plan.joinedChanges.length,
  };
  return plan;
}

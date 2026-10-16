import { eq, inArray } from "drizzle-orm";
import { eventflowSql } from "../db";
import { meqDb, meqSql, schema } from "../db/meq";
import { fetchMemberHubRoster, type HubMember } from "../memberhub";
import { hubEmails, planMemberHubSync, type MeqMemberRow } from "../memberhub-match";
import { safeIso } from "../safe-date";
import { territoryFromCity } from "../territory";
import type { SyncStats } from "./members";

/**
 * Member roster from MemberHub (MEMBER_SOURCE=memberhub). One way only: MEQ
 * reads MemberHub and never writes member data back. Rows are updated in
 * place (never deleted: that cascades to quality, referrals, milestones);
 * members who leave Active keep their row with is_member = false.
 *
 * dryRun: compare only, write nothing, and return the counts + examples.
 */

export type MemberHubReport = {
  dryRun: boolean;
  asOf: string | null;
  counts: Record<string, number>;
  regionChanges: { member_number: number; name: string; city: string | null; from: string; to: string }[];
  leavers: { name: string | null; email: string | null; city: string | null }[];
  created: { member_number: number; name: string; hasEventflowContact: boolean }[];
  duplicates: { member_number: number; name: string }[];
  joinedChanges: { member_number: number; name: string; from: string | null; to: string | null }[];
  /** MemberHub vs what MEQ uses today (HubSpot, via member_quality / member_referrals). */
  fieldDiffs: Record<string, { differ: number; memberhubBlank: number; examples: { name: string; meq: string | null; memberhub: string | null }[] }>;
};

const nameOf = (h: HubMember) => [h.first_name, h.last_name].filter(Boolean).join(" ").trim() || `#${h.member_number}`;

export async function syncMembersFromMemberHub(opts: { dryRun: boolean }): Promise<MemberHubReport & { stats?: SyncStats }> {
  const [roster, rows, efRows, current] = await Promise.all([
    fetchMemberHubRoster(),
    meqSql<
      {
        id: string;
        member_number: number | null;
        hubspot_contact_id: string | null;
        eventflow_contact_id: string | null;
        email: string | null;
        additional_emails: string[] | null;
        is_member: boolean;
        closest_major_city: string | null;
        region: string | null;
        joined_at: Date | null;
        display_name: string | null;
      }[]
    >`SELECT id, member_number, hubspot_contact_id, eventflow_contact_id, lower(email) AS email,
             additional_emails, is_member, closest_major_city, region, joined_at, display_name
      FROM members`,
    // EventFlow already carries MemberHub's member number on every contact.
    eventflowSql<{ id: string; member_number: number }[]>`
      SELECT id, member_number FROM contacts WHERE member_number IS NOT NULL AND deleted_at IS NULL`,
    // What quality + referrals use today, to show what switching changes.
    meqSql<{ id: string; company: string | null; industry: string | null; company_size: string | null; referred_raw: string | null }[]>`
      SELECT m.id, q.company, q.industry, q.company_size, r.raw_name AS referred_raw
      FROM members m
      LEFT JOIN member_quality q ON q.member_id = m.id
      LEFT JOIN member_referrals r ON r.referred_member_id = m.id`,
  ]);

  const meqRows: MeqMemberRow[] = rows.map((r) => ({
    id: r.id,
    memberNumber: r.member_number,
    hubspotContactId: r.hubspot_contact_id,
    eventflowContactId: r.eventflow_contact_id,
    email: r.email,
    additionalEmails: r.additional_emails,
    isMember: r.is_member,
    closestMajorCity: r.closest_major_city,
    region: r.region,
    joinedAt: safeIso(r.joined_at),
  }));
  const efByNumber = new Map(efRows.map((r) => [Number(r.member_number), r.id]));
  const plan = planMemberHubSync(meqRows, roster.members, efByNumber);
  const rowById = new Map(rows.map((r) => [r.id, r]));

  const currentById = new Map(current.map((c) => [c.id, c]));
  const norm = (v: string | null | undefined) => (v ?? "").trim().toLowerCase();
  const fieldDiffs: MemberHubReport["fieldDiffs"] = {};
  const fieldsToCompare: [string, (h: HubMember) => string | null, (c: (typeof current)[number]) => string | null][] = [
    ["company", (h) => h.company, (c) => c.company],
    ["industry", (h) => h.industry, (c) => c.industry],
    ["company_size", (h) => h.company_size, (c) => c.company_size],
    ["referred_by", (h) => h.referred_by ?? null, (c) => c.referred_raw],
  ];
  for (const [field, hubVal, meqVal] of fieldsToCompare) {
    const d = { differ: 0, memberhubBlank: 0, examples: [] as { name: string; meq: string | null; memberhub: string | null }[] };
    for (const m of plan.matched) {
      const c = currentById.get(m.rowId);
      const a = meqVal(c ?? ({} as (typeof current)[number])) ?? null;
      const b = hubVal(m.hub) ?? null;
      if (norm(a) === norm(b)) continue;
      if (!norm(b)) d.memberhubBlank++;
      else d.differ++;
      if (d.examples.length < 12) d.examples.push({ name: nameOf(m.hub), meq: a, memberhub: b });
    }
    fieldDiffs[field] = d;
  }

  const report: MemberHubReport = {
    fieldDiffs,
    dryRun: opts.dryRun,
    asOf: roster.asOf,
    counts: plan.counts,
    regionChanges: plan.regionChanges.map((c) => ({
      member_number: c.hub.member_number,
      name: nameOf(c.hub),
      city: c.hub.closest_major_city,
      from: c.from,
      to: c.to,
    })),
    leavers: plan.leavers.map((l) => ({ name: rowById.get(l.id)?.display_name ?? null, email: l.email, city: l.closestMajorCity })),
    created: plan.created.map((c) => ({ member_number: c.hub.member_number, name: nameOf(c.hub), hasEventflowContact: !!c.eventflowContactId })),
    duplicates: plan.duplicates.map((d) => ({ member_number: d.hub.member_number, name: nameOf(d.hub) })),
    joinedChanges: plan.joinedChanges.slice(0, 50).map((j) => ({
      member_number: j.hub.member_number,
      name: nameOf(j.hub),
      from: j.from,
      to: j.to,
    })),
  };
  if (opts.dryRun) return report;

  // ── Apply ──
  const [run] = await meqDb.insert(schema.memberSyncRuns).values({}).returning({ id: schema.memberSyncRuns.id });
  try {
    const now = new Date();
    const fields = (h: HubMember) => {
      const emails = hubEmails(h);
      const login = h.email_for?.login?.toLowerCase() ?? emails[0] ?? null;
      return {
        member_number: h.member_number,
        hubspot_contact_id: h.accounts?.hubspot_contact_id ?? null,
        slack_user_id: h.accounts?.slack_user_id ?? null,
        circle_member_id: h.accounts?.circle_member_id ?? null,
        email: login,
        additional_emails: emails.filter((e) => e !== login),
        first_name: h.first_name,
        last_name: h.last_name,
        display_name: nameOf(h),
        company: h.company,
        job_title: h.job_title,
        closest_major_city: h.closest_major_city,
        // Region comes from the closest major city (Jarrod, 2026-10-15), not
        // MemberHub's state-first region field.
        region: territoryFromCity(h.closest_major_city),
        joined_at: h.joined_at,
        industry: h.industry,
        company_size: h.company_size,
        referred_by: h.referred_by?.trim() || null,
      };
    };

    // Bulk in-place update, 500 rows per statement.
    const updates = plan.matched.map((m) => ({
      id: m.rowId,
      ...fields(m.hub),
      eventflow_contact_id: rowById.get(m.rowId)?.eventflow_contact_id ?? efByNumber.get(m.hub.member_number) ?? null,
    }));
    for (let i = 0; i < updates.length; i += 500) {
      const chunk = JSON.stringify(updates.slice(i, i + 500));
      await meqSql`
        UPDATE members m SET
          member_number = x.member_number,
          hubspot_contact_id = COALESCE(x.hubspot_contact_id, m.hubspot_contact_id),
          eventflow_contact_id = COALESCE(m.eventflow_contact_id, x.eventflow_contact_id),
          slack_user_id = x.slack_user_id,
          circle_member_id = x.circle_member_id,
          email = COALESCE(x.email, m.email),
          additional_emails = x.additional_emails,
          first_name = x.first_name,
          last_name = x.last_name,
          display_name = x.display_name,
          company = x.company,
          job_title = x.job_title,
          is_member = true,
          closest_major_city = x.closest_major_city,
          region = x.region,
          joined_at = COALESCE(x.joined_at, m.joined_at),
          joined_source = CASE WHEN x.joined_at IS NOT NULL THEN 'memberhub' ELSE m.joined_source END,
          industry = COALESCE(x.industry, m.industry),
          company_size = COALESCE(x.company_size, m.company_size),
          referred_by = x.referred_by,
          last_synced_at = ${now.toISOString()},
          updated_at = ${now.toISOString()}
        FROM jsonb_to_recordset(${chunk}::jsonb) AS x(
          id uuid, member_number int, hubspot_contact_id text, eventflow_contact_id uuid,
          slack_user_id text, circle_member_id text, email text, additional_emails jsonb,
          first_name text, last_name text, display_name text, company text, job_title text,
          closest_major_city text, region text, joined_at timestamptz, industry text, company_size text,
          referred_by text)
        WHERE m.id = x.id`;
    }

    if (plan.created.length) {
      await meqDb.insert(schema.members).values(
        plan.created.map(({ hub, eventflowContactId }) => {
          const f = fields(hub);
          return {
            memberNumber: f.member_number,
            hubspotContactId: f.hubspot_contact_id,
            eventflowContactId,
            slackUserId: f.slack_user_id,
            circleMemberId: f.circle_member_id,
            email: f.email,
            additionalEmails: f.additional_emails,
            firstName: f.first_name,
            lastName: f.last_name,
            displayName: f.display_name,
            company: f.company,
            jobTitle: f.job_title,
            isMember: true,
            closestMajorCity: f.closest_major_city,
            region: f.region,
            joinedAt: f.joined_at ? new Date(f.joined_at) : null,
            joinedSource: f.joined_at ? "memberhub" : null,
            industry: f.industry,
            companySize: f.company_size,
            referredBy: f.referred_by,
            lastSyncedAt: now,
            updatedAt: now,
          };
        })
      );
    }

    // Leavers keep their row (history and snapshots point at it).
    const leaverIds = plan.leavers.map((l) => l.id);
    for (let i = 0; i < leaverIds.length; i += 500) {
      await meqDb
        .update(schema.members)
        .set({ isMember: false, updatedAt: now })
        .where(inArray(schema.members.id, leaverIds.slice(i, i + 500)));
    }

    const stats: SyncStats = {
      contactsSeen: roster.members.length,
      upserted: updates.length + plan.created.length,
      slackMatched: roster.members.filter((h) => h.accounts?.slack_user_id).length,
      circleMatched: roster.members.filter((h) => h.accounts?.circle_member_id).length,
      purged: 0,
    };
    await meqDb
      .update(schema.memberSyncRuns)
      .set({
        finishedAt: new Date(),
        contactsSeen: stats.contactsSeen,
        membersUpserted: stats.upserted,
        slackMatched: stats.slackMatched,
        circleMatched: stats.circleMatched,
        ok: true,
      })
      .where(eq(schema.memberSyncRuns.id, run.id));
    return { ...report, stats };
  } catch (err) {
    await meqDb
      .update(schema.memberSyncRuns)
      .set({ finishedAt: new Date(), ok: false, error: String(err).slice(0, 500) })
      .where(eq(schema.memberSyncRuns.id, run.id));
    throw err;
  }
}

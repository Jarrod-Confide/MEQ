import { eq, sql } from "drizzle-orm";
import { meqDb, schema } from "../db/meq";
import { eventflowSql, slackleSql } from "../db";
import type { NewMember } from "../db/schema";

export type SyncStats = {
  contactsSeen: number;
  upserted: number;
  slackMatched: number;
  circleMatched: number;
};

function parseEmails(
  primary: string | null,
  personal: string | null,
  work: string | null,
  additional: unknown
): string[] {
  const set = new Set<string>();
  for (const e of [primary, personal, work]) if (e) set.add(e.toLowerCase().trim());
  if (additional) {
    const extra = Array.isArray(additional)
      ? additional
      : String(additional).split(/[,;\s]+/);
    for (const e of extra) {
      const x = String(e).toLowerCase().trim();
      if (x.includes("@")) set.add(x);
    }
  }
  return [...set];
}

/**
 * Daily roster sync. EventFlow contacts → MEQ members (canonical), enriched
 * with Slack/Circle IDs by matching Slackle members on any of the contact's
 * emails. Upserts keyed on eventflow_contact_id.
 */
export async function syncMembers(): Promise<SyncStats> {
  const [run] = await meqDb
    .insert(schema.memberSyncRuns)
    .values({})
    .returning({ id: schema.memberSyncRuns.id });
  const runId = run.id;

  try {
    const [contacts, slackleMembers] = await Promise.all([
      eventflowSql<
        {
          id: string;
          hubspot_contact_id: string | null;
          email: string | null;
          personal_email: string | null;
          work_email: string | null;
          additional_emails: unknown;
          first_name: string | null;
          last_name: string | null;
          company: string | null;
          job_title: string | null;
          membership_type: string | null;
          is_member: boolean | null;
          closest_major_city: string | null;
        }[]
      >`SELECT id, hubspot_contact_id, lower(email) AS email,
               lower(personal_email) AS personal_email, lower(work_email) AS work_email,
               additional_emails, first_name, last_name, company, job_title,
               membership_type, is_member, closest_major_city
        FROM contacts`,
      slackleSql<
        { email: string | null; slack_user_id: string | null; circle_member_id: string | null }[]
      >`SELECT lower(email) AS email, slack_user_id, circle_member_id
        FROM members WHERE email IS NOT NULL`,
    ]);

    const idMap = new Map<string, { slack: string | null; circle: string | null }>();
    for (const m of slackleMembers) {
      if (m.email) idMap.set(m.email, { slack: m.slack_user_id, circle: m.circle_member_id });
    }

    let slackMatched = 0;
    let circleMatched = 0;
    const rows: NewMember[] = [];
    const now = new Date();

    for (const c of contacts) {
      const emails = parseEmails(c.email, c.personal_email, c.work_email, c.additional_emails);
      let slackUserId: string | null = null;
      let circleMemberId: string | null = null;
      for (const e of emails) {
        const hit = idMap.get(e);
        if (hit) {
          slackUserId = slackUserId ?? hit.slack;
          circleMemberId = circleMemberId ?? hit.circle;
        }
      }
      if (slackUserId) slackMatched++;
      if (circleMemberId) circleMatched++;

      rows.push({
        eventflowContactId: c.id,
        hubspotContactId: c.hubspot_contact_id,
        slackUserId,
        circleMemberId,
        email: c.email,
        additionalEmails: emails.filter((e) => e !== c.email),
        firstName: c.first_name,
        lastName: c.last_name,
        displayName:
          [c.first_name, c.last_name].filter(Boolean).join(" ").trim() || c.email || null,
        company: c.company,
        jobTitle: c.job_title,
        membershipType: c.membership_type,
        isMember: !!c.is_member,
        closestMajorCity: c.closest_major_city,
        lastSyncedAt: now,
        updatedAt: now,
      });
    }

    // Batched upsert keyed on eventflow_contact_id.
    const CHUNK = 500;
    for (let i = 0; i < rows.length; i += CHUNK) {
      await meqDb
        .insert(schema.members)
        .values(rows.slice(i, i + CHUNK))
        .onConflictDoUpdate({
          target: schema.members.eventflowContactId,
          set: {
            hubspotContactId: sql`excluded.hubspot_contact_id`,
            slackUserId: sql`excluded.slack_user_id`,
            circleMemberId: sql`excluded.circle_member_id`,
            email: sql`excluded.email`,
            additionalEmails: sql`excluded.additional_emails`,
            firstName: sql`excluded.first_name`,
            lastName: sql`excluded.last_name`,
            displayName: sql`excluded.display_name`,
            company: sql`excluded.company`,
            jobTitle: sql`excluded.job_title`,
            membershipType: sql`excluded.membership_type`,
            isMember: sql`excluded.is_member`,
            closestMajorCity: sql`excluded.closest_major_city`,
            lastSyncedAt: sql`excluded.last_synced_at`,
            updatedAt: sql`excluded.updated_at`,
          },
        });
    }

    const stats: SyncStats = {
      contactsSeen: contacts.length,
      upserted: rows.length,
      slackMatched,
      circleMatched,
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
      .where(eq(schema.memberSyncRuns.id, runId));

    return stats;
  } catch (err) {
    await meqDb
      .update(schema.memberSyncRuns)
      .set({ finishedAt: new Date(), ok: false, error: String(err).slice(0, 500) })
      .where(eq(schema.memberSyncRuns.id, runId));
    throw err;
  }
}

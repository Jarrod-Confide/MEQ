import { eventflowSql, slackleSql } from "./db";
import { getEngagement } from "./engagement-cache";
import type { MemberScore } from "./engagement";

export type RecentMessage = {
  source: string;
  isReply: boolean;
  postedAt: string;
  channel: string;
  preview: string;
};

export type EventAttendance = {
  title: string;
  startsAt: string;
  status: string;
};

export type MemberDetail = {
  score: MemberScore;
  emails: string[];
  recentMessages: RecentMessage[];
  events: EventAttendance[];
};

/**
 * Resolve a leaderboard member key back to their underlying records.
 * Keys: "c:<contactId>" (matched), "e:<email>" (slack-only), "dn:<name>".
 */
export async function getMemberDetail(
  key: string,
  days: number
): Promise<MemberDetail | null> {
  const data = await getEngagement(days);
  const score = data.members.find((m) => m.key === key);
  if (!score) return null;

  const since =
    days >= 9999 ? new Date(0) : new Date(Date.now() - days * 86400000);

  // Figure out which emails (and contact id) to query by.
  let emails: string[] = [];
  let displayName: string | null = null;
  let contactId: string | null = null;

  if (key.startsWith("c:")) {
    contactId = key.slice(2);
    const rows = await eventflowSql<
      { email: string | null; personal_email: string | null; work_email: string | null; additional_emails: unknown }[]
    >`SELECT lower(email) AS email, lower(personal_email) AS personal_email,
             lower(work_email) AS work_email, additional_emails
      FROM contacts WHERE id = ${contactId}`;
    const r = rows[0];
    if (r) {
      const set = new Set<string>();
      for (const e of [r.email, r.personal_email, r.work_email]) if (e) set.add(e);
      if (r.additional_emails) {
        const extra = Array.isArray(r.additional_emails)
          ? r.additional_emails
          : String(r.additional_emails).split(/[,;\s]+/);
        for (const e of extra) {
          const x = String(e).toLowerCase().trim();
          if (x.includes("@")) set.add(x);
        }
      }
      emails = [...set];
    }
  } else if (key.startsWith("e:")) {
    emails = [key.slice(2)];
  } else if (key.startsWith("dn:")) {
    displayName = key.slice(3);
  }

  // Recent Slackle messages.
  let recentRows: {
    source: string;
    is_reply: boolean;
    posted_at: Date;
    channel: string | null;
    preview: string | null;
  }[] = [];
  if (emails.length > 0) {
    recentRows = await slackleSql`
      SELECT m.source, (m.source_parent_id IS NOT NULL) AS is_reply, m.posted_at,
             COALESCE(sp.slack_channel_name, sp.circle_space_name, m.source_channel_id) AS channel,
             left(m.body_text, 240) AS preview
      FROM messages m
      LEFT JOIN sync_pairs sp ON m.sync_pair_id = sp.id
      WHERE m.deleted_at IS NULL AND m.posted_at >= ${since}
        AND lower(m.author_email) IN ${slackleSql(emails)}
      ORDER BY m.posted_at DESC LIMIT 25`;
  } else if (displayName) {
    recentRows = await slackleSql`
      SELECT m.source, (m.source_parent_id IS NOT NULL) AS is_reply, m.posted_at,
             COALESCE(sp.slack_channel_name, sp.circle_space_name, m.source_channel_id) AS channel,
             left(m.body_text, 240) AS preview
      FROM messages m
      LEFT JOIN sync_pairs sp ON m.sync_pair_id = sp.id
      WHERE m.deleted_at IS NULL AND m.posted_at >= ${since}
        AND m.author_display_name = ${displayName}
      ORDER BY m.posted_at DESC LIMIT 25`;
  }

  // Event attendance history.
  let events: EventAttendance[] = [];
  if (contactId) {
    const evRows = await eventflowSql<{ title: string | null; starts_at: Date; status: string }[]>`
      SELECT e.title, e.starts_at, a.status
      FROM attendees a JOIN events e ON a.event_id = e.id
      WHERE a.contact_id = ${contactId}
      ORDER BY e.starts_at DESC LIMIT 50`;
    events = evRows.map((e) => ({
      title: e.title ?? "(untitled event)",
      startsAt: e.starts_at.toISOString(),
      status: e.status,
    }));
  }

  return {
    score,
    emails,
    recentMessages: recentRows.map((r) => ({
      source: r.source,
      isReply: r.is_reply,
      postedAt: r.posted_at.toISOString(),
      channel: r.channel ?? "—",
      preview: r.preview ?? "",
    })),
    events,
  };
}

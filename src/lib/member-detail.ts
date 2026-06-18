import { eventflowSql, slackleSql } from "./db";
import { meqSql } from "./db/meq";
import { getFullLeaderboard } from "./leaderboard";
import { passiveTier, type PassiveTier } from "./passive";
import { safeIso } from "./safe-date";
import type { MemberScore } from "./engagement";

export type RecentMessage = {
  source: string;
  isReply: boolean;
  postedAt: string;
  channel: string;
  preview: string;
  substance: number | null; // 0–3
  contentWeight: number | null; // 0–10
  topics: string[];
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
  trend: { week: string; total: number }[];
  topics: { topic: string; count: number }[];
  quality: { score: number | null; tier: string | null } | null;
  passive: { tier: PassiveTier; clicks: number | null; lastClickAt: string | null };
};

/**
 * Resolve a leaderboard member key back to their underlying records.
 * Keys: "c:<contactId>" (matched), "e:<email>" (slack-only), "dn:<name>".
 * Uses the FULL leaderboard so dormant members resolve too (don't 404).
 */
export async function getMemberDetail(
  key: string,
  days: number
): Promise<MemberDetail | null> {
  const data = await getFullLeaderboard(days);
  const score = data.members.find((m) => m.key === key);
  if (!score) return null;

  const since =
    days >= 9999 ? new Date(0) : new Date(Date.now() - days * 86400000);

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

  // Recent Slackle messages (with id, so we can join content scores).
  type MsgRow = { id: string; source: string; is_reply: boolean; posted_at: Date; channel: string | null; preview: string | null };
  let recentRows: MsgRow[] = [];
  if (emails.length > 0) {
    recentRows = await slackleSql<MsgRow[]>`
      SELECT m.id, m.source, (m.source_parent_id IS NOT NULL) AS is_reply, m.posted_at,
             COALESCE(sp.slack_channel_name, sp.circle_space_name, m.source_channel_id) AS channel,
             left(m.body_text, 240) AS preview
      FROM messages m
      LEFT JOIN sync_pairs sp ON m.sync_pair_id = sp.id
      WHERE m.deleted_at IS NULL AND m.posted_at >= ${since}
        AND lower(m.author_email) IN ${slackleSql(emails)}
      ORDER BY m.posted_at DESC LIMIT 25`;
  } else if (displayName) {
    recentRows = await slackleSql<MsgRow[]>`
      SELECT m.id, m.source, (m.source_parent_id IS NOT NULL) AS is_reply, m.posted_at,
             COALESCE(sp.slack_channel_name, sp.circle_space_name, m.source_channel_id) AS channel,
             left(m.body_text, 240) AS preview
      FROM messages m
      LEFT JOIN sync_pairs sp ON m.sync_pair_id = sp.id
      WHERE m.deleted_at IS NULL AND m.posted_at >= ${since}
        AND m.author_display_name = ${displayName}
      ORDER BY m.posted_at DESC LIMIT 25`;
  }

  // Content scores for those messages (MEQ DB), + topic tally across them.
  const scoreByMsg = new Map<string, { substance: number | null; contentWeight: number | null; topics: string[] }>();
  const topicTally = new Map<string, number>();
  if (recentRows.length > 0) {
    const ids = recentRows.map((m) => m.id);
    const scored = await meqSql<{ message_id: string; substance: number | null; content_weight: number | null; topics: string[] | null }[]>`
      SELECT message_id, substance, content_weight, topics
      FROM message_scores WHERE message_id IN ${meqSql(ids)}`;
    for (const s of scored) {
      const topics = Array.isArray(s.topics) ? s.topics : [];
      scoreByMsg.set(s.message_id, { substance: s.substance, contentWeight: s.content_weight, topics });
      for (const t of topics) topicTally.set(t, (topicTally.get(t) ?? 0) + 1);
    }
  }
  const topics = [...topicTally.entries()].map(([topic, count]) => ({ topic, count })).sort((a, b) => b.count - a.count).slice(0, 8);

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
      startsAt: safeIso(e.starts_at) ?? "",
      status: e.status,
    }));
  }

  // Engagement trend (weekly snapshots) + quality + passive email — MEQ DB.
  let trend: { week: string; total: number }[] = [];
  let quality: { score: number | null; tier: string | null } | null = null;
  let passive: { tier: PassiveTier; clicks: number | null; lastClickAt: string | null } = { tier: null, clicks: null, lastClickAt: null };
  if (contactId) {
    const [snaps, mq] = await Promise.all([
      meqSql<{ week_start: Date; total: number | null }[]>`
        SELECT week_start, total FROM member_engagement_snapshots
        WHERE eventflow_contact_id = ${contactId} ORDER BY week_start`,
      meqSql<{ quality_score: number | null; quality_tier: string | null; email_clicks: number | null; email_last_click_at: Date | null; email_last_open_at: Date | null }[]>`
        SELECT mq.quality_score, mq.quality_tier, mq.email_clicks, mq.email_last_click_at, mq.email_last_open_at
        FROM member_quality mq JOIN members mem ON mem.id = mq.member_id
        WHERE mem.eventflow_contact_id = ${contactId} LIMIT 1`,
    ]);
    trend = snaps.map((s) => ({ week: (safeIso(s.week_start) ?? "").slice(0, 10), total: Math.round(s.total ?? 0) }));
    const q = mq[0];
    if (q) {
      quality = { score: q.quality_score, tier: q.quality_tier };
      passive = {
        tier: passiveTier(q.email_clicks, q.email_last_click_at, q.email_last_open_at),
        clicks: q.email_clicks,
        lastClickAt: safeIso(q.email_last_click_at),
      };
    }
  }

  return {
    score,
    emails,
    recentMessages: recentRows.map((r) => {
      const s = scoreByMsg.get(r.id);
      return {
        source: r.source,
        isReply: r.is_reply,
        postedAt: safeIso(r.posted_at) ?? "",
        channel: r.channel ?? "—",
        preview: r.preview ?? "",
        substance: s?.substance ?? null,
        contentWeight: s?.contentWeight ?? null,
        topics: s?.topics ?? [],
      };
    }),
    events,
    trend,
    topics,
    quality,
    passive,
  };
}

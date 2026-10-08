import { sql as drizzleSql } from "drizzle-orm";
import { eventflowSql, slackleSql } from "../db";
import { meqDb, meqSql, schema } from "../db/meq";
import { firstOnOrAfterJoin } from "../new-members";
import { safeIso } from "../safe-date";

/**
 * Recompute each member's first engagement after joining, per channel
 * (member_milestones). Three databases, so it runs in a cron, never a page.
 * Activity is reduced to one row per person per day before it leaves each
 * database, which keeps the transfer small.
 */
export async function refreshMilestones(): Promise<{ members: number; withAny: number }> {
  const [members, attendance, posts, reactions] = await Promise.all([
    meqSql<{ id: string; ef: string | null; email: string | null; extra: unknown; joined_at: Date }[]>`
      SELECT id, eventflow_contact_id AS ef, lower(email) AS email, additional_emails AS extra, joined_at
      FROM members WHERE is_member AND joined_at IS NOT NULL`,
    eventflowSql<{ contact_id: string; day: Date; is_virtual: boolean }[]>`
      SELECT a.contact_id, date_trunc('day', e.starts_at) AS day,
             COALESCE(t.invite_mode = 'gcal_broadcast', false) AS is_virtual
      FROM attendees a
      JOIN events e ON e.id = a.event_id
      LEFT JOIN event_types t ON t.id = e.event_type_id
      WHERE a.status = 'attended' AND NOT e.is_test
      GROUP BY 1, 2, 3`,
    slackleSql<{ email: string; day: Date }[]>`
      SELECT lower(author_email) AS email, date_trunc('day', posted_at) AS day
      FROM messages WHERE deleted_at IS NULL AND author_email IS NOT NULL
      GROUP BY 1, 2`,
    slackleSql<{ email: string; day: Date }[]>`
      SELECT lower(reactor_email) AS email, date_trunc('day', created_at) AS day
      FROM reactions WHERE removed_at IS NULL AND reactor_email IS NOT NULL
      GROUP BY 1, 2`,
  ]);

  // key → ascending ISO days
  const index = <T,>(rows: T[], key: (r: T) => string | null, day: (r: T) => Date) => {
    const m = new Map<string, string[]>();
    for (const r of rows) {
      const k = key(r);
      const d = safeIso(day(r));
      if (!k || !d) continue;
      const list = m.get(k);
      if (list) list.push(d);
      else m.set(k, [d]);
    }
    for (const list of m.values()) list.sort();
    return m;
  };
  const inPerson = index(attendance.filter((a) => !a.is_virtual), (a) => a.contact_id, (a) => a.day);
  const virtual = index(attendance.filter((a) => a.is_virtual), (a) => a.contact_id, (a) => a.day);
  const postsBy = index(posts, (p) => p.email, (p) => p.day);
  const reactsBy = index(reactions, (r) => r.email, (r) => r.day);

  const earliest = (lists: (string[] | undefined)[], joined: string) =>
    lists
      .map((l) => firstOnOrAfterJoin(l, joined))
      .filter((d): d is string => !!d)
      .sort()[0] ?? null;

  const now = new Date();
  let withAny = 0;
  const rows = members.flatMap((m) => {
    const joined = safeIso(m.joined_at);
    if (!joined) return [];
    const emails = new Set<string>();
    if (m.email) emails.add(m.email);
    if (Array.isArray(m.extra)) for (const e of m.extra) if (typeof e === "string" && e) emails.add(e.toLowerCase());
    const byEmail = (idx: Map<string, string[]>) => [...emails].map((e) => idx.get(e));
    const row = {
      memberId: m.id,
      firstEventAt: m.ef ? earliest([inPerson.get(m.ef)], joined) : null,
      firstVirtualAt: m.ef ? earliest([virtual.get(m.ef)], joined) : null,
      firstPostAt: earliest(byEmail(postsBy), joined),
      firstReactionAt: earliest(byEmail(reactsBy), joined),
    };
    if (row.firstEventAt || row.firstVirtualAt || row.firstPostAt || row.firstReactionAt) withAny++;
    return [
      {
        memberId: row.memberId,
        firstEventAt: row.firstEventAt ? new Date(row.firstEventAt) : null,
        firstVirtualAt: row.firstVirtualAt ? new Date(row.firstVirtualAt) : null,
        firstPostAt: row.firstPostAt ? new Date(row.firstPostAt) : null,
        firstReactionAt: row.firstReactionAt ? new Date(row.firstReactionAt) : null,
        computedAt: now,
      },
    ];
  });

  const CHUNK = 500;
  for (let i = 0; i < rows.length; i += CHUNK) {
    await meqDb
      .insert(schema.memberMilestones)
      .values(rows.slice(i, i + CHUNK))
      .onConflictDoUpdate({
        target: schema.memberMilestones.memberId,
        set: {
          firstEventAt: drizzleSql`excluded.first_event_at`,
          firstVirtualAt: drizzleSql`excluded.first_virtual_at`,
          firstPostAt: drizzleSql`excluded.first_post_at`,
          firstReactionAt: drizzleSql`excluded.first_reaction_at`,
          computedAt: drizzleSql`excluded.computed_at`,
        },
      });
  }
  return { members: rows.length, withAny };
}

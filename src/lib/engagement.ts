import { eventflowSql, slackleSql } from "./db";
import { meqSql } from "./db/meq";

// ─── Tunable config ─────────────────────────────────────────────────────────
// Weights and decay follow the CISO Community Engagement Ranking framework.
// Everything here is meant to be tuned against real data — change the numbers,
// not the structure.

export const HALF_LIFE_DAYS = 90; // slow cadence for a CISO community

/** Per-action base weights, before time-decay and quality multiplier. */
export const WEIGHTS = {
  post: 10, // top-level Slack/Circle message
  reply: 5, // thread reply
  reactionGiven: 0.5,
  reactionReceived: 1,
  replyReceived: 3, // another member replied to your post
  activeDay: 2, // each distinct day with any activity
  attended: 50, // in-person event attendance (no virtual split yet)
  noShow: -2,
  spoke: 75, // DEFERRED: no speaker→contact link in EventFlow yet (always 0 today)
} as const;

/** How the dimensions roll up into the composite total. Must sum to 1.
 * `connector` (community-building: job posts + member intros) is a deliberate
 * small-weight contributor — it counts, but substantive knowledge dominates. */
export const DIMENSION_WEIGHTS = {
  presence: 0.13,
  contribution: 0.3,
  reciprocity: 0.18,
  reach: 0.12,
  depth: 0.2,
  connector: 0.07,
} as const;

export type Dimension = keyof typeof DIMENSION_WEIGHTS;
const DIMENSIONS = Object.keys(DIMENSION_WEIGHTS) as Dimension[];

export const TIERS = ["Champion", "Active", "Engaged", "Light", "Dormant"] as const;
export type Tier = (typeof TIERS)[number];
// Cumulative top-fractions: Champion top 10%, Active next 20%, etc.
const TIER_CUTOFFS: { tier: Tier; topFraction: number }[] = [
  { tier: "Champion", topFraction: 0.1 },
  { tier: "Active", topFraction: 0.3 },
  { tier: "Engaged", topFraction: 0.6 },
  { tier: "Light", topFraction: 0.9 },
  { tier: "Dormant", topFraction: 1.0 },
];

// Staff / bot exclusions — mirrors Slackle's engagement endpoint.
const EXCLUDED_DOMAINS = ["confide.group", "thecisosociety.com"];
const EXCLUDED_DISPLAY_NAMES = ["Socio"];

function isExcluded(email: string | null, displayName: string | null): boolean {
  if (displayName && EXCLUDED_DISPLAY_NAMES.includes(displayName)) return true;
  if (email) {
    const domain = email.split("@").pop()?.toLowerCase();
    if (domain && EXCLUDED_DOMAINS.includes(domain)) return true;
  }
  return false;
}

// ─── Types ──────────────────────────────────────────────────────────────────

export type SignalCounts = {
  posts: number;
  replies: number;
  reactionsGiven: number;
  reactionsReceived: number;
  repliesReceived: number;
  eventsAttended: number;
  noShows: number;
  activeDays: number;
  connectorActions: number; // job posts + member intros
  avgSubstance: number; // mean content substance (0–3) across their messages
};

export type MemberScore = {
  key: string;
  name: string;
  email: string | null;
  hubspotContactId: string | null;
  isMember: boolean;
  matched: boolean; // linked to an EventFlow contact
  dimensions: Record<Dimension, number>; // normalized 0–100
  total: number; // 0–100
  tier: Tier;
  signals: SignalCounts;
  lastActiveAt: string | null;
  // Decorated server-side from MEQ's member_quality (cross-pollination).
  qualityScore?: number | null;
  qualityTier?: string | null;
};

export type EngagementResult = {
  members: MemberScore[];
  window: { since: string; until: string; days: number };
  scoredCount: number;
  tierCounts: Record<Tier, number>;
  computedAt: string;
};

// ─── Internal accumulator ─────────────────────────────────────────────────────

type ContactIdentity = {
  id: string;
  hubspotContactId: string | null;
  name: string;
  primaryEmail: string | null;
  isMember: boolean;
};

type Acc = {
  key: string;
  name: string;
  email: string | null;
  hubspotContactId: string | null;
  isMember: boolean;
  matched: boolean;
  raw: Record<Dimension, number>;
  signals: SignalCounts;
  activeDays: Map<string, number>; // dayKey → decay factor for that day
  lastActiveMs: number;
  substanceSum: number; // for avgSubstance
  substanceCount: number;
};

// ─── Main entry point ─────────────────────────────────────────────────────────

export async function computeEngagement(
  opts: { sinceDays?: number } = {}
): Promise<EngagementResult> {
  const until = new Date();
  const sinceDays = opts.sinceDays ?? 90;
  const since =
    sinceDays >= 9999
      ? new Date(0)
      : new Date(until.getTime() - sinceDays * 86400000);
  const nowMs = until.getTime();

  const decay = (d: Date | string) => {
    const daysAgo = Math.max(0, (nowMs - new Date(d).getTime()) / 86400000);
    return Math.pow(0.5, daysAgo / HALF_LIFE_DAYS);
  };
  const dayKey = (d: Date | string) => new Date(d).toISOString().slice(0, 10);

  // Pull everything in parallel. Volumes are small (~5K Slackle rows, ~3K EF).
  const [contacts, messages, reactionsGiven, reactionsRecv, repliesRecv, attendance, msgScores] =
    await Promise.all([
      eventflowSql<
        {
          id: string;
          hubspot_contact_id: string | null;
          first_name: string | null;
          last_name: string | null;
          is_member: boolean | null;
          email: string | null;
          personal_email: string | null;
          work_email: string | null;
          additional_emails: unknown;
        }[]
      >`SELECT id, hubspot_contact_id, first_name, last_name, is_member,
               lower(email) AS email, lower(personal_email) AS personal_email,
               lower(work_email) AS work_email, additional_emails
        FROM contacts`,

      slackleSql<
        {
          id: string;
          email: string | null;
          display_name: string | null;
          source: string;
          is_reply: boolean;
          posted_at: Date;
          chars: number;
        }[]
      >`SELECT id, lower(author_email) AS email, author_display_name AS display_name,
               source, (source_parent_id IS NOT NULL) AS is_reply,
               posted_at, length(body_text) AS chars
        FROM messages
        WHERE deleted_at IS NULL AND posted_at >= ${since}`,

      slackleSql<{ email: string | null; display_name: string | null; created_at: Date }[]>`
        SELECT lower(reactor_email) AS email, reactor_display_name AS display_name, created_at
        FROM reactions WHERE removed_at IS NULL AND created_at >= ${since}`,

      slackleSql<{ email: string | null; display_name: string | null; created_at: Date }[]>`
        SELECT lower(m.author_email) AS email, m.author_display_name AS display_name, r.created_at
        FROM reactions r JOIN messages m ON r.message_id = m.id
        WHERE r.removed_at IS NULL AND m.deleted_at IS NULL AND r.created_at >= ${since}`,

      slackleSql<{ email: string | null; display_name: string | null; posted_at: Date }[]>`
        SELECT lower(parent.author_email) AS email, parent.author_display_name AS display_name,
               reply.posted_at
        FROM messages reply
        JOIN messages parent
          ON reply.source_parent_id = parent.source_id AND reply.source = parent.source
        WHERE reply.source_parent_id IS NOT NULL
          AND reply.deleted_at IS NULL AND parent.deleted_at IS NULL
          AND reply.posted_at >= ${since}
          AND reply.author_email IS DISTINCT FROM parent.author_email`,

      eventflowSql<{ contact_id: string; status: string; starts_at: Date }[]>`
        SELECT a.contact_id, a.status, e.starts_at
        FROM attendees a JOIN events e ON a.event_id = e.id
        WHERE a.status IN ('attended', 'no_show') AND e.starts_at >= ${since}`,

      // Content scores (MEQ DB) — substance-based weight per message.
      meqSql<
        { message_id: string; content_weight: number; substance: number; is_connector: boolean }[]
      >`SELECT message_id, content_weight, substance, is_connector FROM message_scores`,
    ]);

  // message_id → content score (in-memory join; different DB).
  const scoreById = new Map<string, { weight: number; substance: number; connector: boolean }>();
  for (const s of msgScores) {
    scoreById.set(s.message_id, {
      weight: s.content_weight ?? 0,
      substance: s.substance ?? 0,
      connector: !!s.is_connector,
    });
  }
  // Fallback weight for not-yet-scored messages (rollout window / brand-new
  // messages between daily scoring runs): a modest length proxy on the same
  // 0–10 scale, so they still count without dominating.
  const fallbackWeight = (chars: number) => Math.max(0.5, Math.min(5, chars / 60));

  // ── Identity: map every EventFlow email → its contact ──
  const emailToContact = new Map<string, ContactIdentity>();
  const contactById = new Map<string, ContactIdentity>();
  for (const c of contacts) {
    const name =
      [c.first_name, c.last_name].filter(Boolean).join(" ").trim() ||
      c.email ||
      "(unknown)";
    const identity: ContactIdentity = {
      id: c.id,
      hubspotContactId: c.hubspot_contact_id,
      name,
      primaryEmail: c.email,
      isMember: !!c.is_member,
    };
    contactById.set(c.id, identity);
    const emails = [c.email, c.personal_email, c.work_email];
    if (c.additional_emails) {
      const extra = Array.isArray(c.additional_emails)
        ? c.additional_emails
        : String(c.additional_emails).split(/[,;\s]+/);
      for (const e of extra) emails.push(String(e).toLowerCase().trim());
    }
    for (const e of emails) {
      if (e && e.includes("@") && !emailToContact.has(e)) emailToContact.set(e, identity);
    }
  }

  // ── Accumulate per canonical member ──
  const accs = new Map<string, Acc>();

  const blankSignals = (): SignalCounts => ({
    posts: 0,
    replies: 0,
    reactionsGiven: 0,
    reactionsReceived: 0,
    repliesReceived: 0,
    eventsAttended: 0,
    noShows: 0,
    activeDays: 0,
    connectorActions: 0,
    avgSubstance: 0,
  });

  function getAccByEmail(email: string | null, displayName: string | null): Acc | null {
    if (isExcluded(email, displayName)) return null;
    const contact = email ? emailToContact.get(email) : undefined;
    let key: string;
    let acc: Acc | undefined;
    if (contact) {
      key = `c:${contact.id}`;
      acc = accs.get(key);
      if (!acc) {
        acc = freshAcc(key, contact.name, contact.primaryEmail, contact.hubspotContactId, contact.isMember, true);
        accs.set(key, acc);
      }
    } else {
      key = email ? `e:${email}` : `dn:${displayName ?? "(unknown)"}`;
      acc = accs.get(key);
      if (!acc) {
        acc = freshAcc(key, displayName ?? email ?? "(unknown)", email, null, false, false);
        accs.set(key, acc);
      }
    }
    return acc;
  }

  function freshAcc(
    key: string,
    name: string,
    email: string | null,
    hs: string | null,
    isMember: boolean,
    matched: boolean
  ): Acc {
    return {
      key,
      name,
      email,
      hubspotContactId: hs,
      isMember,
      matched,
      raw: { presence: 0, contribution: 0, reciprocity: 0, reach: 0, depth: 0, connector: 0 },
      signals: blankSignals(),
      activeDays: new Map(),
      lastActiveMs: 0,
      substanceSum: 0,
      substanceCount: 0,
    };
  }

  const touch = (acc: Acc, d: Date | string) => {
    const ms = new Date(d).getTime();
    if (ms > acc.lastActiveMs) acc.lastActiveMs = ms;
  };

  // Messages → content-weighted Contribution (top-level posts) /
  // Reciprocity (replies) / Connector (job posts + intros) + Presence.
  // The per-message `content_weight` (0–10, substance-based) replaces the old
  // raw post/reply count × length proxy, so "thanks!" ≈ 0 and a detailed
  // answer scores high. Connector-type messages route to their own dimension.
  for (const m of messages) {
    const acc = getAccByEmail(m.email, m.display_name);
    if (!acc) continue;
    const dec = decay(m.posted_at);
    const score = scoreById.get(m.id);
    const weight = score ? score.weight : fallbackWeight(m.chars);

    if (score?.connector) {
      acc.raw.connector += weight * dec;
      acc.signals.connectorActions += 1;
    } else if (m.is_reply) {
      acc.raw.reciprocity += weight * dec;
      acc.signals.replies += 1;
    } else {
      acc.raw.contribution += weight * dec;
      acc.signals.posts += 1;
    }
    // Track substance for the avgSubstance signal (scored messages only).
    if (score) {
      acc.substanceSum += score.substance;
      acc.substanceCount += 1;
    }
    const dk = dayKey(m.posted_at);
    const existing = acc.activeDays.get(dk) ?? 0;
    if (dec > existing) acc.activeDays.set(dk, dec);
    touch(acc, m.posted_at);
  }

  // Reactions given → Reciprocity
  for (const r of reactionsGiven) {
    const acc = getAccByEmail(r.email, r.display_name);
    if (!acc) continue;
    acc.raw.reciprocity += WEIGHTS.reactionGiven * decay(r.created_at);
    acc.signals.reactionsGiven += 1;
    touch(acc, r.created_at);
  }

  // Reactions received → Reach
  for (const r of reactionsRecv) {
    const acc = getAccByEmail(r.email, r.display_name);
    if (!acc) continue;
    acc.raw.reach += WEIGHTS.reactionReceived * decay(r.created_at);
    acc.signals.reactionsReceived += 1;
  }

  // Replies received → Reach
  for (const r of repliesRecv) {
    const acc = getAccByEmail(r.email, r.display_name);
    if (!acc) continue;
    acc.raw.reach += WEIGHTS.replyReceived * decay(r.posted_at);
    acc.signals.repliesReceived += 1;
  }

  // Event attendance → Depth + Presence
  for (const a of attendance) {
    const contact = contactById.get(a.contact_id);
    if (!contact) continue;
    const key = `c:${contact.id}`;
    let acc = accs.get(key);
    if (!acc) {
      acc = freshAcc(key, contact.name, contact.primaryEmail, contact.hubspotContactId, contact.isMember, true);
      accs.set(key, acc);
    }
    const dec = decay(a.starts_at);
    if (a.status === "attended") {
      acc.raw.depth += WEIGHTS.attended * dec;
      acc.raw.presence += WEIGHTS.attended * dec * 0.2; // attendance is also presence
      acc.signals.eventsAttended += 1;
      touch(acc, a.starts_at);
    } else if (a.status === "no_show") {
      acc.raw.depth += WEIGHTS.noShow * dec;
      acc.signals.noShows += 1;
    }
  }

  // Finalize active-days presence contribution + avgSubstance
  for (const acc of accs.values()) {
    let presenceDays = 0;
    for (const dec of acc.activeDays.values()) presenceDays += WEIGHTS.activeDay * dec;
    acc.raw.presence += presenceDays;
    acc.signals.activeDays = acc.activeDays.size;
    acc.signals.avgSubstance = acc.substanceCount
      ? Math.round((acc.substanceSum / acc.substanceCount) * 100) / 100
      : 0;
  }

  // Keep only members with at least one signal in the window
  const scored = [...accs.values()].filter((a) => {
    const s = a.signals;
    return (
      s.posts + s.replies + s.reactionsGiven + s.reactionsReceived + s.repliesReceived + s.eventsAttended + s.noShows > 0
    );
  });

  // ── Normalize each dimension to 0–100 via the 95th-percentile member ──
  const p95: Record<Dimension, number> = { presence: 0, contribution: 0, reciprocity: 0, reach: 0, depth: 0, connector: 0 };
  for (const dim of DIMENSIONS) {
    const vals = scored.map((a) => a.raw[dim]).filter((v) => v > 0).sort((x, y) => x - y);
    p95[dim] = vals.length ? (vals[Math.floor(0.95 * (vals.length - 1))] || vals[vals.length - 1]) : 0;
  }

  const members: MemberScore[] = scored.map((a) => {
    const dimensions = {} as Record<Dimension, number>;
    let total = 0;
    for (const dim of DIMENSIONS) {
      const norm = p95[dim] > 0 ? Math.min(100, (a.raw[dim] / p95[dim]) * 100) : 0;
      dimensions[dim] = Math.round(norm * 10) / 10;
      total += DIMENSION_WEIGHTS[dim] * norm;
    }
    return {
      key: a.key,
      name: a.name,
      email: a.email,
      hubspotContactId: a.hubspotContactId,
      isMember: a.isMember,
      matched: a.matched,
      dimensions,
      total: Math.round(total * 10) / 10,
      tier: "Dormant" as Tier, // assigned below
      signals: a.signals,
      lastActiveAt: a.lastActiveMs ? new Date(a.lastActiveMs).toISOString() : null,
    };
  });

  // ── Tier by rank percentile ──
  members.sort((a, b) => b.total - a.total);
  const n = members.length;
  const tierCounts: Record<Tier, number> = {
    Champion: 0,
    Active: 0,
    Engaged: 0,
    Light: 0,
    Dormant: 0,
  };
  members.forEach((m, i) => {
    const frac = n > 1 ? i / (n - 1) : 0;
    const tier = TIER_CUTOFFS.find((t) => frac <= t.topFraction)!.tier;
    m.tier = tier;
    tierCounts[tier] += 1;
  });

  return {
    members,
    window: { since: since.toISOString(), until: until.toISOString(), days: sinceDays },
    scoredCount: n,
    tierCounts,
    computedAt: until.toISOString(),
  };
}

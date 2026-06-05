import { unstable_cache } from "next/cache";
import { meqSql } from "./db/meq";
import { type Territory } from "./territory";

/** Safe ISO — returns null for missing / out-of-range dates (postgres
 * 'infinity' or year > 275760 would otherwise throw "Invalid time value"). */
function safeIso(d: Date | string | null | undefined): string | null {
  if (!d) return null;
  const t = new Date(d);
  return isNaN(t.getTime()) ? null : t.toISOString();
}

export type OutreachRow = {
  memberId: string | null;
  name: string | null;
  company: string | null;
  email: string | null;
  slackUserId: string | null;
  circleMemberId: string | null;
  territory: Territory;
  qualityScore: number | null;
  qualityTier: string | null;
  engagementScore: number | null;
  engagementTier: string | null;
  priorScore: number | null;
  deltaScore: number | null; // current - prior (engagement)
  joinedAt: string | null;
  eventsDim: number;
  connectorDim: number;
  reason: string;
};

export type OutreachSegment = {
  key: string;
  label: string;
  description: string;
  action: string; // suggested CM action
  rows: OutreachRow[];
};

export type OutreachData = {
  segments: OutreachSegment[];
  week: string | null;
  territory: Territory | "ALL";
  counts: Record<string, number>;
};

type RawRow = {
  week_start: Date;
  member_key: string;
  member_id: string | null;
  name: string | null;
  territory: string | null;
  total: number | null;
  tier: string | null;
  dimensions: Record<string, number> | null;
  quality_score: number | null;
  quality_tier: string | null;
  prior_total: number | null;
  prior_tier: string | null;
  email: string | null;
  slack_user_id: string | null;
  circle_member_id: string | null;
  joined_at: Date | null;
  company: string | null;
};

const HIGH_Q = new Set(["Platinum", "Gold"]);
const LOW_E = new Set(["Light", "Dormant"]);
const NEW_MEMBER_DAYS = 45;

/**
 * Builds ranked, territory-scoped outreach segments from the latest weekly
 * snapshot (joined to the roster for contact info) plus a ~4-week-prior
 * snapshot to detect decline. Designed to be a CM's daily worklist.
 */
export async function fetchOutreach(territory: Territory | "ALL" = "ALL"): Promise<OutreachData> {
  const rows = await meqSql<RawRow[]>`
    WITH latest AS (SELECT MAX(week_start) w FROM member_engagement_snapshots),
    prior AS (
      SELECT week_start FROM member_engagement_snapshots
      WHERE week_start <= (SELECT w FROM latest) - INTERVAL '28 days'
      ORDER BY week_start DESC LIMIT 1
    )
    SELECT s.week_start, s.member_key, s.member_id, s.name, s.territory, s.total, s.tier,
           s.dimensions, s.quality_score, s.quality_tier,
           p.total AS prior_total, p.tier AS prior_tier,
           m.email, m.slack_user_id, m.circle_member_id, m.joined_at,
           mq.company
    FROM member_engagement_snapshots s
    LEFT JOIN member_engagement_snapshots p
      ON p.member_key = s.member_key AND p.week_start = (SELECT week_start FROM prior)
    LEFT JOIN members m ON m.id = s.member_id
    LEFT JOIN member_quality mq ON mq.member_id = s.member_id
    WHERE s.week_start = (SELECT w FROM latest)
  `;

  const week = rows.length ? safeIso(rows[0].week_start) : null;
  const nowMs = Date.now();

  const mapped: OutreachRow[] = rows
    .filter((r) => (territory === "ALL" ? true : (r.territory ?? "INTL") === territory))
    .map((r) => {
      const dims = r.dimensions ?? {};
      const delta =
        r.total != null && r.prior_total != null ? Math.round((r.total - r.prior_total) * 10) / 10 : null;
      return {
        memberId: r.member_id,
        name: r.name,
        company: r.company,
        email: r.email,
        slackUserId: r.slack_user_id,
        circleMemberId: r.circle_member_id,
        territory: ((r.territory as Territory) ?? "INTL") as Territory,
        qualityScore: r.quality_score,
        qualityTier: r.quality_tier,
        engagementScore: r.total != null ? Math.round(r.total * 10) / 10 : null,
        engagementTier: r.tier,
        priorScore: r.prior_total != null ? Math.round(r.prior_total * 10) / 10 : null,
        deltaScore: delta,
        joinedAt: safeIso(r.joined_at),
        eventsDim: Math.round(dims.events ?? 0),
        connectorDim: Math.round(dims.connector ?? 0),
        reason: "",
      };
    });

  const daysSince = (iso: string | null) =>
    iso ? (nowMs - new Date(iso).getTime()) / 86400000 : Infinity;

  // ── Segment builders ──────────────────────────────────────────────────────
  const priority = mapped
    .filter((r) => r.qualityTier && HIGH_Q.has(r.qualityTier) && r.engagementTier && LOW_E.has(r.engagementTier))
    .map((r) => ({ ...r, reason: `${r.qualityTier} quality but ${r.engagementTier} engagement` }))
    .sort((a, b) => (b.qualityScore ?? 0) - (a.qualityScore ?? 0));

  const atRisk = mapped
    .filter((r) => r.priorScore != null && r.priorScore >= 40 && r.deltaScore != null && r.deltaScore <= -8)
    .map((r) => ({ ...r, reason: `engagement down ${Math.abs(r.deltaScore ?? 0)} pts in 4 weeks` }))
    .sort((a, b) => (a.deltaScore ?? 0) - (b.deltaScore ?? 0));

  const dormant = mapped
    .filter((r) => r.engagementTier === "Dormant")
    .map((r) => ({ ...r, reason: r.qualityTier && HIGH_Q.has(r.qualityTier) ? `Dormant + ${r.qualityTier} quality` : "Dormant" }))
    .sort((a, b) => (b.qualityScore ?? 0) - (a.qualityScore ?? 0));

  const newMember = mapped
    .filter((r) => daysSince(r.joinedAt) <= NEW_MEMBER_DAYS && (!r.engagementTier || LOW_E.has(r.engagementTier)))
    .map((r) => ({ ...r, reason: `joined ${Math.round(daysSince(r.joinedAt))}d ago, low first activity` }))
    .sort((a, b) => daysSince(a.joinedAt) - daysSince(b.joinedAt));

  const connectors = mapped
    .filter((r) => r.connectorDim >= 20)
    .map((r) => ({ ...r, reason: `strong connector (job posts / intros)` }))
    .sort((a, b) => b.connectorDim - a.connectorDim);

  const neverAttended = mapped
    .filter((r) => r.eventsDim === 0 && r.qualityTier && HIGH_Q.has(r.qualityTier))
    .map((r) => ({ ...r, reason: `${r.qualityTier} quality, never attended an event` }))
    .sort((a, b) => (b.qualityScore ?? 0) - (a.qualityScore ?? 0));

  const segments: OutreachSegment[] = [
    {
      key: "priority",
      label: "Priority outreach",
      description: "High-quality members with low engagement — the biggest upside.",
      action: "Personal welcome + invite to a relevant discussion or upcoming event.",
      rows: priority,
    },
    {
      key: "at_risk",
      label: "At-risk (declining)",
      description: "Previously engaged members whose engagement dropped over the last 4 weeks.",
      action: "Check in before they go dormant — reference what they used to engage with.",
      rows: atRisk,
    },
    {
      key: "dormant",
      label: "Dormant reactivation",
      description: "Gone quiet — prioritized by quality.",
      action: "Re-engage with a targeted ask or 1:1 intro.",
      rows: dormant,
    },
    {
      key: "new_member",
      label: "New-member activation",
      description: `Joined in the last ${NEW_MEMBER_DAYS} days with little first activity.`,
      action: "Onboard to a first post/reply or event within their first weeks.",
      rows: newMember,
    },
    {
      key: "connectors",
      label: "Connectors to leverage",
      description: "Members who post jobs / make introductions — community glue.",
      action: "Recruit them to welcome newcomers and host intros.",
      rows: connectors,
    },
    {
      key: "never_attended",
      label: "Never-attended high-quality",
      description: "High-quality members who've never attended an event.",
      action: "Targeted invite to the next regional dinner/event.",
      rows: neverAttended,
    },
  ];

  const counts: Record<string, number> = {};
  for (const s of segments) counts[s.key] = s.rows.length;

  return { segments, week, territory, counts };
}

/** Cached wrapper (5 min) — keeps rapid territory navigation off the DB. */
export function getOutreach(territory: Territory | "ALL" = "ALL"): Promise<OutreachData> {
  return unstable_cache(() => fetchOutreach(territory), ["outreach", territory], {
    revalidate: 300,
    tags: ["snapshots"],
  })();
}

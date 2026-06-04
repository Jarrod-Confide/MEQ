import Anthropic from "@anthropic-ai/sdk";
import { sql as drizzleSql } from "drizzle-orm";
import { slackleSql } from "../db";
import { meqDb, meqSql, schema } from "../db/meq";
import type { NewMessageScore } from "../db/schema";

// ─── Config ───────────────────────────────────────────────────────────────
// Haiku is plenty for this rubric; override with MEQ_SCORING_MODEL if needed.
const MODEL = process.env.MEQ_SCORING_MODEL || "claude-haiku-4-5-20251001";
const BATCH_SIZE = 15; // messages per LLM call
const MAX_CHARS = 1200; // truncate each message body for the prompt

// Message types the rubric assigns. `job_post` + `networking_intro` are the
// "connector" types (community-building, not CISO knowledge).
export const MESSAGE_TYPES = [
  "answer",
  "insight",
  "resource",
  "question",
  "discussion",
  "social",
  "logistics",
  "job_post",
  "networking_intro",
  "noise",
] as const;
const CONNECTOR_TYPES = new Set(["job_post", "networking_intro"]);

// Bot / staff we never score (mirrors engagement.ts exclusions).
const EXCLUDED_DOMAINS = ["confide.group", "thecisosociety.com"];
const EXCLUDED_DISPLAY_NAMES = ["Socio"];

const SYSTEM_PROMPT = `You score Slack/Circle messages from a private community of Chief Information Security Officers (CISOs). The goal is to measure how much SUBSTANCE each message carries for a CISO peer community — so the platform can reward thoughtful contribution over raw volume.

For EACH message, return:
- "type": one of answer | insight | resource | question | discussion | social | logistics | job_post | networking_intro | noise
   • answer = substantive answer/advice responding to a peer
   • insight = experience-share, opinion with reasoning, candid vendor/tool take
   • resource = shares a tool/link/framework WITH useful context
   • question = asks the community something substantive
   • discussion = starts a topic/debate likely to draw responses
   • social = greetings, thanks, congrats, banter, welcomes
   • logistics = event coordination, scheduling, "see you there"
   • job_post = job/role posting or hiring call
   • networking_intro = introducing/connecting people, "reach out to X", member intros
   • noise = bot output, tests, empty/meaningless
- "substance": integer 0-3. 0 = no transferable knowledge ("thanks!", "+1"); 1 = minor; 2 = useful (a real named tool + brief experience, a real question with context); 3 = rich (detailed advice, framework, strong candid vendor teardown).
- "on_topic": boolean — is it relevant to CISO/security/leadership concerns (vs purely social)?
- "topics": array of 0-3 short lowercase domain tags from this set when relevant: ["threat_intel","vuln_mgmt","appsec","cloud_security","iam","grc_compliance","regulatory","incident_response","vendor_eval","third_party_risk","ai_security","privacy","board_budget","career","certifications","leadership","tooling"]. Empty array if none apply.
- "content_weight": number 0-10 = overall value to the community. Anchors: pure social/logistics/noise = 0-1; bare link or low-context job post = 1-2; good question with context = 5-6; solid insight/answer (substance 2) = 5-7; rich/expert contribution (substance 3) = 8-10. Connector types (job_post, networking_intro) are valuable but NOT knowledge — cap their content_weight at 3.

Respond with ONLY a JSON array, one object per input message, each including its "i" index. No prose, no markdown fences.`;

const client = () =>
  new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function isExcluded(email: string | null, displayName: string | null): boolean {
  if (displayName && EXCLUDED_DISPLAY_NAMES.includes(displayName)) return true;
  if (email) {
    const domain = email.split("@").pop()?.toLowerCase();
    if (domain && EXCLUDED_DOMAINS.includes(domain)) return true;
  }
  return false;
}

type RawMessage = {
  id: string;
  source: string;
  email: string | null;
  display_name: string | null;
  posted_at: Date;
  is_reply: boolean;
  body_text: string;
};

async function withBackoff<T>(fn: () => Promise<T>, label: string): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      return await fn();
    } catch (e: unknown) {
      lastErr = e;
      const status = (e as { status?: number })?.status;
      // Retry only on rate-limit / transient server errors.
      if (status && status !== 429 && status < 500) throw e;
      const waitMs = Math.min(30_000, 1000 * 2 ** attempt);
      await new Promise((r) => setTimeout(r, waitMs));
    }
  }
  throw new Error(`${label} failed after retries: ${String(lastErr)}`);
}

function clampInt(v: unknown, lo: number, hi: number, dflt: number): number {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return dflt;
  return Math.max(lo, Math.min(hi, Math.round(n)));
}
function clampNum(v: unknown, lo: number, hi: number, dflt: number): number {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return dflt;
  return Math.max(lo, Math.min(hi, n));
}

function parseScores(text: string): Record<string, unknown>[] {
  // Extract the first JSON array, tolerating stray prose / fences.
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start === -1 || end === -1 || end < start) return [];
  try {
    const arr = JSON.parse(text.slice(start, end + 1));
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

async function scoreBatch(batch: RawMessage[]): Promise<NewMessageScore[]> {
  const listing = batch
    .map((m, i) => {
      const body = m.body_text.length > MAX_CHARS ? m.body_text.slice(0, MAX_CHARS) + "…" : m.body_text;
      const kind = m.is_reply ? "reply" : "top-level";
      return `[${i}] (${kind}) ${JSON.stringify(body)}`;
    })
    .join("\n");

  const resp = await withBackoff(
    () =>
      client().messages.create({
        model: MODEL,
        max_tokens: 2048,
        temperature: 0,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: `Score these ${batch.length} messages:\n\n${listing}` }],
      }),
    "haiku.messages.create"
  );

  const text = resp.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
  const parsed = parseScores(text);
  const byIndex = new Map<number, Record<string, unknown>>();
  for (const o of parsed) {
    const i = clampInt((o as { i?: unknown }).i, 0, batch.length - 1, -1);
    if (i >= 0) byIndex.set(i, o);
  }

  const now = new Date();
  const rows: NewMessageScore[] = [];
  for (let i = 0; i < batch.length; i++) {
    const m = batch[i];
    const o = byIndex.get(i);
    if (!o) continue; // model dropped this one; leave unscored to retry next run
    let type = String((o.type as string) ?? "noise").toLowerCase();
    if (!(MESSAGE_TYPES as readonly string[]).includes(type)) type = "insight";
    const isConnector = CONNECTOR_TYPES.has(type);
    let contentWeight = clampNum(o.content_weight, 0, 10, 0);
    if (isConnector) contentWeight = Math.min(contentWeight, 3); // connector cap
    const topics = Array.isArray(o.topics)
      ? (o.topics as unknown[]).map((t) => String(t)).slice(0, 3)
      : [];
    rows.push({
      messageId: m.id,
      source: m.source,
      type,
      substance: clampInt(o.substance, 0, 3, 0),
      onTopic: Boolean(o.on_topic),
      topics,
      contentWeight,
      isConnector,
      authorEmail: m.email,
      postedAt: m.posted_at,
      model: MODEL,
      scoredAt: now,
    });
  }
  return rows;
}

export type ScoreRunStats = {
  unscored: number;
  attempted: number;
  scored: number;
  batches: number;
  model: string;
};

/**
 * Score Slackle messages that don't yet have a row in message_scores.
 * Incremental + idempotent: safe to run daily (only new messages cost tokens).
 * @param opts.limit cap messages scored this run (default 6000 = whole corpus).
 */
export async function scoreMessages(opts: { limit?: number } = {}): Promise<ScoreRunStats> {
  const limit = opts.limit ?? 6000;

  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY not set — cannot score messages.");
  }

  // 1) All scorable Slackle messages.
  const messages = await slackleSql<RawMessage[]>`
    SELECT id, source, lower(author_email) AS email, author_display_name AS display_name,
           posted_at, (source_parent_id IS NOT NULL) AS is_reply, body_text
    FROM messages
    WHERE deleted_at IS NULL
      AND body_text IS NOT NULL
      AND length(trim(body_text)) > 0`;

  // 2) Already-scored ids (from MEQ).
  const existing = await meqSql<{ message_id: string }[]>`SELECT message_id FROM message_scores`;
  const scoredIds = new Set(existing.map((r) => r.message_id));

  // 3) Unscored, skipping bot/staff to save tokens.
  const todo = messages
    .filter((m) => !scoredIds.has(m.id) && !isExcluded(m.email, m.display_name))
    .slice(0, limit);

  let scored = 0;
  let batches = 0;
  for (let i = 0; i < todo.length; i += BATCH_SIZE) {
    const batch = todo.slice(i, i + BATCH_SIZE);
    const rows = await scoreBatch(batch);
    batches++;
    if (rows.length) {
      // Upsert (re-score overwrites on re-run).
      await meqDb
        .insert(schema.messageScores)
        .values(rows)
        .onConflictDoUpdate({
          target: schema.messageScores.messageId,
          set: {
            source: drizzleSql`excluded.source`,
            type: drizzleSql`excluded.type`,
            substance: drizzleSql`excluded.substance`,
            onTopic: drizzleSql`excluded.on_topic`,
            topics: drizzleSql`excluded.topics`,
            contentWeight: drizzleSql`excluded.content_weight`,
            isConnector: drizzleSql`excluded.is_connector`,
            authorEmail: drizzleSql`excluded.author_email`,
            postedAt: drizzleSql`excluded.posted_at`,
            model: drizzleSql`excluded.model`,
            scoredAt: drizzleSql`excluded.scored_at`,
          },
        });
      scored += rows.length;
    }
  }

  return {
    unscored: messages.filter((m) => !scoredIds.has(m.id) && !isExcluded(m.email, m.display_name)).length,
    attempted: todo.length,
    scored,
    batches,
    model: MODEL,
  };
}

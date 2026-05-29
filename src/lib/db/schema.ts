import {
  pgTable,
  uuid,
  text,
  boolean,
  timestamp,
  integer,
  jsonb,
  index,
} from "drizzle-orm/pg-core";

/**
 * Canonical MEQ member roster. Source of truth for "who is a member",
 * synced daily from EventFlow contacts (richest roster) and enriched with
 * Slack/Circle identity from Slackle. Everything in MEQ reads from here
 * instead of cross-querying EventFlow + Slackle at request time.
 *
 * Join key precedence: hubspot_contact_id (canonical) → email.
 */
export const members = pgTable(
  "members",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    // ── Identity ──
    hubspotContactId: text("hubspot_contact_id").unique(),
    eventflowContactId: uuid("eventflow_contact_id").unique(),
    slackUserId: text("slack_user_id"),
    circleMemberId: text("circle_member_id"),
    email: text("email"),
    // Lowercased extra emails (personal/work/additional) used for matching.
    additionalEmails: jsonb("additional_emails").$type<string[]>().default([]),

    // ── Profile ──
    firstName: text("first_name"),
    lastName: text("last_name"),
    displayName: text("display_name"),
    company: text("company"),
    jobTitle: text("job_title"),
    membershipType: text("membership_type"),
    isMember: boolean("is_member").notNull().default(false),
    closestMajorCity: text("closest_major_city"),

    // ── Company quality (populated by a later enrichment pass) ──
    companySize: text("company_size"),
    industry: text("industry"),
    isFortune1000: boolean("is_fortune_1000"),
    companyTier: text("company_tier"),

    // ── Membership lifecycle ──
    // Sourced from HubSpot: prefer date_joined__the_ciso_society_; fall back
    // to createdate. joined_source records which one was used.
    joinedAt: timestamp("joined_at", { withTimezone: true }),
    joinedSource: text("joined_source"),

    // ── Bookkeeping ──
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
  },
  (t) => ({
    emailIdx: index("members_email_idx").on(t.email),
    slackIdx: index("members_slack_idx").on(t.slackUserId),
    circleIdx: index("members_circle_idx").on(t.circleMemberId),
  })
);

/** Audit row per sync run — how many upserted/matched, timing, errors. */
export const memberSyncRuns = pgTable("member_sync_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  contactsSeen: integer("contacts_seen").notNull().default(0),
  membersUpserted: integer("members_upserted").notNull().default(0),
  slackMatched: integer("slack_matched").notNull().default(0),
  circleMatched: integer("circle_matched").notNull().default(0),
  ok: boolean("ok").notNull().default(false),
  error: text("error"),
});

/**
 * Member quality — employer/role attributes that define how "high quality"
 * a CISO member is. Sourced from HubSpot contact properties. 1:1 with
 * members. v1 "high quality" = works for a Fortune 2000 company; seniority
 * + team size are captured now so the definition can expand.
 */
export const memberQuality = pgTable("member_quality", {
  id: uuid("id").primaryKey().defaultRandom(),
  memberId: uuid("member_id")
    .references(() => members.id, { onDelete: "cascade" })
    .notNull()
    .unique(),

  // Denormalized for a self-contained quality view.
  name: text("name"),
  company: text("company"),
  industry: text("industry"), // company object's `industry` enum value (raw)

  // ── HubSpot contact properties (raw) ──
  companySize: text("company_size"), // numemployees: "1-5" … "1000+"
  employmentStatus: text("employment_status"), // Employed | vCISO | In Transition
  reportingTo: text("reporting_to"), // CEO | CIO | Board | …
  seniority: text("seniority"), // hs_seniority: C-Level | VP | …
  teamSize: text("team_size"), // Just Me (Solo) | 1-5 | … | 100+

  // ── Derived ──
  employmentType: text("employment_type"), // employed | self_employed | in_transition | unknown
  isFortune2000: boolean("is_fortune_2000").notNull().default(false),
  isHighQuality: boolean("is_high_quality").notNull().default(false),
  tags: jsonb("tags").$type<string[]>().default([]),

  // ── Quality ranking (0–100 weighted score + subscores + tier) ──
  qualityScore: integer("quality_score"),
  qualityTier: text("quality_tier"),
  prominenceScore: integer("prominence_score"),
  authorityScore: integer("authority_score"),
  teamScore: integer("team_score"),
  employmentScore: integer("employment_score"),

  syncedAt: timestamp("synced_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export type Member = typeof members.$inferSelect;
export type NewMember = typeof members.$inferInsert;
export type MemberQuality = typeof memberQuality.$inferSelect;
export type NewMemberQuality = typeof memberQuality.$inferInsert;

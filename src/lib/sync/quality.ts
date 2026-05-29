import { sql, isNotNull, eq } from "drizzle-orm";
import { meqDb, schema } from "../db/meq";
import { batchReadContacts, batchRead, batchReadAssociations } from "../hubspot";
import { isFortune2000 } from "../fortune";
import { computeQuality } from "../quality-score";
import type { NewMemberQuality } from "../db/schema";

export type QualityStats = {
  membersWithHubspot: number;
  hubspotFetched: number;
  upserted: number;
  selfEmployed: number;
  fortune2000: number;
  highQuality: number;
  joinedAtUpdated: number;
};

const HS_PROPS = [
  "current_employment_status",
  "reporting_to_",
  "hs_seniority",
  "team_size",
  "numemployees",
  "company",
  "firstname",
  "lastname",
  "date_joined__the_ciso_society_",
  "createdate",
];

function classifyEmployment(status: string | null): string {
  switch (status) {
    case "Employed":
      return "employed";
    case "vCISO":
      return "self_employed";
    case "In Transition":
      return "in_transition";
    default:
      return "unknown";
  }
}

function buildTags(p: {
  employmentType: string;
  reportingTo: string | null;
  seniority: string | null;
  teamSize: string | null;
  isFortune2000: boolean;
}): string[] {
  const tags: string[] = [];
  if (p.employmentType === "self_employed") tags.push("self_employed");
  if (p.employmentType === "in_transition") tags.push("in_transition");
  if (p.isFortune2000) tags.push("fortune_2000");
  if (p.reportingTo === "CEO" || p.reportingTo === "Board") tags.push("reports_to_ceo");
  if (p.seniority === "C-Level") tags.push("c_level");
  if (p.teamSize === "51-100" || p.teamSize === "100+") tags.push("large_team");
  return tags;
}

/**
 * Enrich MEQ members with HubSpot company-quality attributes. Pulls
 * employment/seniority/team-size/company-size for every member with a
 * hubspot_contact_id, derives the quality flags, and upserts member_quality.
 *
 * v1 "high quality" = works for a Fortune 2000 company. Seniority + team
 * size are captured for the definition to expand later.
 */
export async function enrichQuality(): Promise<QualityStats> {
  const rows = await meqDb
    .select({
      id: schema.members.id,
      hubspotContactId: schema.members.hubspotContactId,
      name: schema.members.displayName,
      company: schema.members.company,
    })
    .from(schema.members)
    .where(isNotNull(schema.members.hubspotContactId));

  const idToMember = new Map(rows.map((r) => [r.hubspotContactId as string, r]));
  const contactIds = rows.map((r) => r.hubspotContactId as string);
  const contacts = await batchReadContacts(contactIds, HS_PROPS);

  // Company size lives on the associated COMPANY (company_size enum range),
  // which is far better populated than the contact's numemployees. Resolve
  // each contact's primary company, then read its size.
  const contactToCompanies = await batchReadAssociations("contacts", "companies", contactIds);
  const companyIds = [
    ...new Set(
      [...contactToCompanies.values()].map((ids) => ids[0]).filter((id): id is string => !!id)
    ),
  ];
  const companies = await batchRead("companies", companyIds, ["company_size", "name"]);
  const companyById = new Map(
    companies.map((c) => [
      c.id,
      { size: c.properties.company_size || null, name: c.properties.name || null },
    ])
  );

  const now = new Date();
  // Keyed by memberId so merged HubSpot contacts (which resolve to the same
  // canonical id) don't produce duplicate rows in one upsert batch.
  const byMember = new Map<string, NewMemberQuality>();
  // Collected joined_at values, applied as a bulk member update after the
  // quality upserts succeed.
  const memberJoinedAt = new Map<string, { joinedAt: Date; source: string }>();

  for (const c of contacts) {
    const member = idToMember.get(c.id);
    if (!member) continue;
    const p = c.properties;

    // Membership join date: prefer the CISO Society-specific property; fall
    // back to HubSpot's contact createdate.
    const dateJoinedStr = p.date_joined__the_ciso_society_;
    const createdateStr = p.createdate;
    let joinedAt: Date | null = null;
    let joinedSource: string | null = null;
    if (dateJoinedStr) {
      const d = new Date(dateJoinedStr);
      if (!isNaN(d.getTime())) {
        joinedAt = d;
        joinedSource = "date_joined";
      }
    }
    if (!joinedAt && createdateStr) {
      const d = new Date(createdateStr);
      if (!isNaN(d.getTime())) {
        joinedAt = d;
        joinedSource = "createdate";
      }
    }
    if (joinedAt && joinedSource) {
      memberJoinedAt.set(member.id, { joinedAt, source: joinedSource });
    }

    // Use the canonical associated COMPANY record for name + size; fall back
    // to the contact's free-text company/numemployees only when there's no
    // company association. The company object's name is deduped and more
    // reliable for Fortune 2000 matching than the contact free-text.
    const primaryCompanyId = contactToCompanies.get(c.id)?.[0];
    const companyObj = primaryCompanyId ? companyById.get(primaryCompanyId) : null;
    const company = companyObj?.name || p.company || member.company || null;
    const companySize = companyObj?.size || p.numemployees || null;
    const employmentType = classifyEmployment(p.current_employment_status);
    const isF2000 = isFortune2000(company);
    const isHigh = isF2000; // v1 definition

    const name =
      [p.firstname, p.lastname].filter(Boolean).join(" ").trim() || member.name || null;
    const tags = buildTags({
      employmentType,
      reportingTo: p.reporting_to_,
      seniority: p.hs_seniority,
      teamSize: p.team_size,
      isFortune2000: isF2000,
    });

    const q = computeQuality({
      companySize,
      isFortune2000: isF2000,
      seniority: p.hs_seniority,
      reportingTo: p.reporting_to_,
      teamSize: p.team_size,
      employmentType,
    });

    byMember.set(member.id, {
      memberId: member.id,
      name,
      company,
      companySize,
      employmentStatus: p.current_employment_status || null,
      reportingTo: p.reporting_to_ || null,
      seniority: p.hs_seniority || null,
      teamSize: p.team_size || null,
      employmentType,
      isFortune2000: isF2000,
      isHighQuality: isHigh,
      tags,
      qualityScore: q.score,
      qualityTier: q.tier,
      prominenceScore: q.prominence,
      authorityScore: q.authority,
      teamScore: q.team,
      employmentScore: q.employment,
      syncedAt: now,
      updatedAt: now,
    });
  }

  const values = [...byMember.values()];
  const selfEmployed = values.filter((v) => v.employmentType === "self_employed").length;
  const fortune2000 = values.filter((v) => v.isFortune2000).length;
  const highQuality = values.filter((v) => v.isHighQuality).length;

  const CHUNK = 500;
  for (let i = 0; i < values.length; i += CHUNK) {
    await meqDb
      .insert(schema.memberQuality)
      .values(values.slice(i, i + CHUNK))
      .onConflictDoUpdate({
        target: schema.memberQuality.memberId,
        set: {
          name: sql`excluded.name`,
          company: sql`excluded.company`,
          companySize: sql`excluded.company_size`,
          employmentStatus: sql`excluded.employment_status`,
          reportingTo: sql`excluded.reporting_to`,
          seniority: sql`excluded.seniority`,
          teamSize: sql`excluded.team_size`,
          employmentType: sql`excluded.employment_type`,
          isFortune2000: sql`excluded.is_fortune_2000`,
          isHighQuality: sql`excluded.is_high_quality`,
          tags: sql`excluded.tags`,
          qualityScore: sql`excluded.quality_score`,
          qualityTier: sql`excluded.quality_tier`,
          prominenceScore: sql`excluded.prominence_score`,
          authorityScore: sql`excluded.authority_score`,
          teamScore: sql`excluded.team_score`,
          employmentScore: sql`excluded.employment_score`,
          syncedAt: sql`excluded.synced_at`,
          updatedAt: sql`excluded.updated_at`,
        },
      });
  }

  // Bulk-update members.joined_at from the collected HubSpot dates.
  // Parallel chunks of 50 — keeps the cron well under maxDuration.
  const joinedEntries = [...memberJoinedAt.entries()];
  let joinedAtUpdated = 0;
  for (let i = 0; i < joinedEntries.length; i += 50) {
    const slice = joinedEntries.slice(i, i + 50);
    await Promise.all(
      slice.map(([memberId, { joinedAt, source }]) =>
        meqDb
          .update(schema.members)
          .set({ joinedAt, joinedSource: source, updatedAt: new Date() })
          .where(eq(schema.members.id, memberId))
      )
    );
    joinedAtUpdated += slice.length;
  }

  return {
    membersWithHubspot: rows.length,
    hubspotFetched: contacts.length,
    upserted: values.length,
    selfEmployed,
    fortune2000,
    highQuality,
    joinedAtUpdated,
  };
}

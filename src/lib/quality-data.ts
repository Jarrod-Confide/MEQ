import { desc } from "drizzle-orm";
import { meqDb, schema } from "./db/meq";
import { QUALITY_TIER_ORDER } from "./quality-tiers";

export { QUALITY_TIER_ORDER };

export type QualityRow = {
  memberId: string;
  name: string | null;
  company: string | null;
  companySize: string | null;
  employmentType: string | null;
  reportingTo: string | null;
  seniority: string | null;
  teamSize: string | null;
  isFortune2000: boolean;
  isHighQuality: boolean;
  tags: string[];
  qualityScore: number | null;
  qualityTier: string | null;
  prominenceScore: number | null;
  authorityScore: number | null;
  teamScore: number | null;
  employmentScore: number | null;
};

export type QualityData = {
  rows: QualityRow[];
  total: number;
  stats: {
    highQuality: number;
    fortune2000: number;
    selfEmployed: number;
    reportsToCeo: number;
    cLevel: number;
  };
  tierCounts: Record<string, number>;
  syncedAt: string | null;
};

export async function fetchQuality(): Promise<QualityData> {
  const rows = await meqDb
    .select({
      memberId: schema.memberQuality.memberId,
      name: schema.memberQuality.name,
      company: schema.memberQuality.company,
      companySize: schema.memberQuality.companySize,
      employmentType: schema.memberQuality.employmentType,
      reportingTo: schema.memberQuality.reportingTo,
      seniority: schema.memberQuality.seniority,
      teamSize: schema.memberQuality.teamSize,
      isFortune2000: schema.memberQuality.isFortune2000,
      isHighQuality: schema.memberQuality.isHighQuality,
      tags: schema.memberQuality.tags,
      qualityScore: schema.memberQuality.qualityScore,
      qualityTier: schema.memberQuality.qualityTier,
      prominenceScore: schema.memberQuality.prominenceScore,
      authorityScore: schema.memberQuality.authorityScore,
      teamScore: schema.memberQuality.teamScore,
      employmentScore: schema.memberQuality.employmentScore,
      syncedAt: schema.memberQuality.syncedAt,
    })
    .from(schema.memberQuality)
    .orderBy(desc(schema.memberQuality.qualityScore), schema.memberQuality.name);

  const mapped: QualityRow[] = rows.map((r) => ({
    memberId: r.memberId,
    name: r.name,
    company: r.company,
    companySize: r.companySize,
    employmentType: r.employmentType,
    reportingTo: r.reportingTo,
    seniority: r.seniority,
    teamSize: r.teamSize,
    isFortune2000: r.isFortune2000,
    isHighQuality: r.isHighQuality,
    tags: r.tags ?? [],
    qualityScore: r.qualityScore,
    qualityTier: r.qualityTier,
    prominenceScore: r.prominenceScore,
    authorityScore: r.authorityScore,
    teamScore: r.teamScore,
    employmentScore: r.employmentScore,
  }));

  const has = (r: QualityRow, t: string) => r.tags.includes(t);
  const tierCounts: Record<string, number> = {};
  for (const t of QUALITY_TIER_ORDER) tierCounts[t] = 0;
  for (const r of mapped) if (r.qualityTier) tierCounts[r.qualityTier] = (tierCounts[r.qualityTier] ?? 0) + 1;

  return {
    rows: mapped,
    total: mapped.length,
    stats: {
      highQuality: mapped.filter((r) => r.isHighQuality).length,
      fortune2000: mapped.filter((r) => r.isFortune2000).length,
      selfEmployed: mapped.filter((r) => r.employmentType === "self_employed").length,
      reportsToCeo: mapped.filter((r) => has(r, "reports_to_ceo")).length,
      cLevel: mapped.filter((r) => has(r, "c_level")).length,
    },
    tierCounts,
    syncedAt: rows[0]?.syncedAt ? new Date(rows[0].syncedAt).toISOString() : null,
  };
}

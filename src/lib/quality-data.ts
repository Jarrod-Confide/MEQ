import { desc } from "drizzle-orm";
import { meqDb, schema } from "./db/meq";

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
  syncedAt: string | null;
};

/** Ordering so the most "senior" levels sort first in the table. */
const SENIORITY_RANK: Record<string, number> = {
  "C-Level": 6,
  owner: 5,
  partner: 5,
  vp: 4,
  director: 3,
  manager: 2,
  "In Transition": 1,
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
      syncedAt: schema.memberQuality.syncedAt,
    })
    .from(schema.memberQuality)
    .orderBy(desc(schema.memberQuality.isHighQuality), schema.memberQuality.name);

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
  }));

  // Stable secondary sort by seniority rank within the high-quality grouping.
  mapped.sort((a, b) => {
    if (a.isHighQuality !== b.isHighQuality) return a.isHighQuality ? -1 : 1;
    const rb = (b.seniority && SENIORITY_RANK[b.seniority]) || 0;
    const ra = (a.seniority && SENIORITY_RANK[a.seniority]) || 0;
    if (rb !== ra) return rb - ra;
    return (a.name ?? "").localeCompare(b.name ?? "");
  });

  const has = (r: QualityRow, t: string) => r.tags.includes(t);
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
    syncedAt: rows[0]?.syncedAt ? new Date(rows[0].syncedAt).toISOString() : null,
  };
}

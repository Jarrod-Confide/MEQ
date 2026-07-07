import { unstable_cache } from "next/cache";
import { eq } from "drizzle-orm";
import { meqDb, schema } from "./db/meq";
import { getEngagement } from "./engagement-cache";
import { territoryFromCity, type Territory } from "./territory";

export type QuadrantPoint = {
  memberId: string;
  eventflowContactId: string | null;
  name: string | null;
  company: string | null;
  email: string | null;
  territory: Territory;
  quality: number; // 0–100 (Unranked / no data → 0)
  engagement: number; // 0–100, 1-decimal (no activity → 0)
};

export type QuadrantData = {
  points: QuadrantPoint[];
  total: number;
};

/**
 * Every MEQ member as a point in quality×engagement space. Silent members
 * (no Slack/event activity → not in the engagement leaderboard) get
 * engagement 0 so the FULL membership shows, including the dormant cloud.
 */
export async function fetchQuadrant(): Promise<QuadrantData> {
  const [rows, eng] = await Promise.all([
    meqDb
      .select({
        id: schema.members.id,
        eventflowContactId: schema.members.eventflowContactId,
        name: schema.members.displayName,
        email: schema.members.email,
        city: schema.members.closestMajorCity,
        company: schema.memberQuality.company,
        qualityScore: schema.memberQuality.qualityScore,
      })
      .from(schema.members)
      .leftJoin(schema.memberQuality, eq(schema.memberQuality.memberId, schema.members.id)),
    getEngagement(90),
  ]);

  const engByEf = new Map<string, number>();
  for (const m of eng.members) {
    if (m.key.startsWith("c:")) engByEf.set(m.key.slice(2), m.total);
  }

  const points: QuadrantPoint[] = rows.map((r) => ({
    memberId: r.id,
    eventflowContactId: r.eventflowContactId ?? null,
    name: r.name,
    company: r.company,
    email: r.email,
    territory: territoryFromCity(r.city),
    quality: r.qualityScore ?? 0,
    engagement: r.eventflowContactId
      ? Math.round((engByEf.get(r.eventflowContactId) ?? 0) * 10) / 10
      : 0,
  }));

  return { points, total: points.length };
}

/** Cached wrapper (5 min). */
export function getQuadrant(): Promise<QuadrantData> {
  return unstable_cache(() => fetchQuadrant(), ["quadrant"], {
    revalidate: 300,
    tags: ["snapshots", "engagement"],
  })();
}

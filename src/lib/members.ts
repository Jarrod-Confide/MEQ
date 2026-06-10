import { eq, isNotNull } from "drizzle-orm";
import { meqDb, schema } from "./db/meq";
import { CITY_GEO, flagForCity, type GeoCity } from "./cities";
import { getEngagement } from "./engagement-cache";

/**
 * Map of EventFlow contact id → country flag emoji (from closest major city).
 * Matches the engagement scorer's `c:<eventflow_contact_id>` keys so the
 * leaderboard can show where each member is from.
 */
export async function fetchFlagByEventflowId(): Promise<Map<string, string>> {
  const rows = await meqDb
    .select({ ef: schema.members.eventflowContactId, city: schema.members.closestMajorCity })
    .from(schema.members)
    .where(isNotNull(schema.members.eventflowContactId));
  const m = new Map<string, string>();
  for (const r of rows) {
    if (!r.ef) continue;
    const flag = flagForCity(r.city);
    if (flag) m.set(r.ef, flag);
  }
  return m;
}

export type CityPoint = GeoCity & {
  members: number;
  avgQuality: number | null;
  avgEngagement: number | null;
  highQuality: number; // Platinum + Gold count
  champions: number; // Champion + Active engagement count
  priority: number; // high quality but NOT champion (low engagement)
};

export type UnmatchedCity = {
  city: string;
  members: number;
};

export type MemberMapData = {
  points: CityPoint[];
  unmatched: UnmatchedCity[];
  totalMembers: number;
  totalCities: number;
  totalCountries: number;
  topMetro: { name: string; members: number } | null;
};

/**
 * Aggregates the canonical MEQ member roster by city and joins quality
 * (from member_quality) + engagement (from the cached leaderboard) so the
 * map can color bubbles by Density / Quality / Engagement / Priority.
 */
export async function fetchMemberMap(): Promise<MemberMapData> {
  const [rows, engagement] = await Promise.all([
    meqDb
      .select({
        eventflowContactId: schema.members.eventflowContactId,
        city: schema.members.closestMajorCity,
        qualityScore: schema.memberQuality.qualityScore,
        qualityTier: schema.memberQuality.qualityTier,
      })
      .from(schema.members)
      .leftJoin(schema.memberQuality, eq(schema.memberQuality.memberId, schema.members.id))
      .where(isNotNull(schema.members.closestMajorCity)),
    getEngagement(90),
  ]);

  // Engagement by EventFlow contact id (matches MEQ members.eventflow_contact_id).
  const engByEf = new Map<string, { score: number; tier: string }>();
  for (const m of engagement.members) {
    if (m.key.startsWith("c:")) engByEf.set(m.key.slice(2), { score: m.total, tier: m.tier });
  }

  type Agg = {
    members: number;
    qSum: number;
    qN: number;
    eSum: number;
    eN: number;
    highQuality: number;
    champions: number;
    priority: number;
  };
  const cityAgg = new Map<string, Agg>();

  for (const r of rows) {
    const city = r.city;
    if (!city || !city.trim() || city === "N/A") continue;
    let agg = cityAgg.get(city);
    if (!agg) {
      agg = {
        members: 0,
        qSum: 0,
        qN: 0,
        eSum: 0,
        eN: 0,
        highQuality: 0,
        champions: 0,
        priority: 0,
      };
      cityAgg.set(city, agg);
    }
    agg.members += 1;
    if (r.qualityScore != null) {
      agg.qSum += r.qualityScore;
      agg.qN += 1;
    }
    const isHighQ = r.qualityTier === "Platinum" || r.qualityTier === "Gold";
    if (isHighQ) agg.highQuality += 1;

    const eng = r.eventflowContactId ? engByEf.get(r.eventflowContactId) : null;
    if (eng) {
      agg.eSum += eng.score;
      agg.eN += 1;
    }
    const isChamp = eng?.tier === "Champion" || eng?.tier === "Active";
    if (isChamp) agg.champions += 1;

    // Priority outreach = strategic member who isn't actively engaging.
    if (isHighQ && !isChamp) agg.priority += 1;
  }

  const points: CityPoint[] = [];
  const unmatched: UnmatchedCity[] = [];
  for (const [city, agg] of cityAgg) {
    const geo = CITY_GEO[city];
    if (geo) {
      points.push({
        ...geo,
        members: agg.members,
        avgQuality: agg.qN ? Math.round(agg.qSum / agg.qN) : null,
        avgEngagement: agg.eN ? Math.round(agg.eSum / agg.eN) : null,
        highQuality: agg.highQuality,
        champions: agg.champions,
        priority: agg.priority,
      });
    } else {
      unmatched.push({ city, members: agg.members });
    }
  }

  points.sort((a, b) => b.members - a.members);

  const totalMembers = points.reduce((s, p) => s + p.members, 0);
  const countries = new Set(points.map((p) => p.country));
  const topMetro = points[0]
    ? { name: points[0].name, members: points[0].members }
    : null;

  return {
    points,
    unmatched,
    totalMembers,
    totalCities: points.length,
    totalCountries: countries.size,
    topMetro,
  };
}

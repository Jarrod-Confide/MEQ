import { sql } from "./db";
import { CITY_GEO, type GeoCity } from "./cities";

export type CityPoint = GeoCity & {
  members: number;
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
 * Pulls active-member counts grouped by closest_major_city from EventFlow's
 * contacts table, then joins against the static geo lookup. Cities that
 * don't match the lookup are returned in `unmatched` for the admin queue.
 *
 * Uses a 5-minute revalidation window — engagement geography is a slow
 * signal and the contact ingest only refreshes daily anyway.
 */
export async function fetchMemberMap(): Promise<MemberMapData> {
  const rows = await sql<{ city: string; members: number }[]>`
    SELECT closest_major_city AS city, COUNT(*)::int AS members
    FROM contacts
    WHERE closest_major_city IS NOT NULL
      AND closest_major_city <> ''
      AND closest_major_city <> 'N/A'
    GROUP BY closest_major_city
    ORDER BY members DESC
  `;

  const points: CityPoint[] = [];
  const unmatched: UnmatchedCity[] = [];

  for (const row of rows) {
    const geo = CITY_GEO[row.city];
    if (geo) {
      points.push({ ...geo, members: row.members });
    } else {
      unmatched.push({ city: row.city, members: row.members });
    }
  }

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

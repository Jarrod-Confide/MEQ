import { CITY_GEO } from "./cities";

/**
 * North America split into four geographic quadrants for the four community
 * managers. Lines are CONFIGURABLE — members cluster in the Northeast, so the
 * NE book will be heaviest; nudge these to rebalance without other changes.
 *   - East / West divided at LON_SPLIT (≈ 100°W, mid-continent)
 *   - North / South divided at LAT_SPLIT (≈ 39.5°N, ~Mason-Dixon)
 */
export const LON_SPLIT = -100;
export const LAT_SPLIT = 39.5;

// North America = US, Canada, Mexico (+ common territory codes).
const NA_COUNTRIES = new Set(["US", "USA", "CA", "MX", "PR"]);

export const TERRITORIES = ["NE", "SE", "NW", "SW", "INTL"] as const;
export type Territory = (typeof TERRITORIES)[number];

export const TERRITORY_LABEL: Record<Territory, string> = {
  NE: "Northeast",
  SE: "Southeast",
  NW: "Northwest",
  SW: "Southwest",
  INTL: "International",
};

export const TERRITORY_ORDER: Territory[] = ["NE", "SE", "NW", "SW", "INTL"];

export const TERRITORY_COLOR: Record<Territory, string> = {
  NE: "#8ab4ff",
  SE: "#22c55e",
  NW: "#a78bfa",
  SW: "#facc15",
  INTL: "#6a7da0",
};

/** Assign a quadrant from coordinates + country. Non-NA → INTL. */
export function territoryFromCoords(
  lat: number,
  lng: number,
  country: string | null | undefined
): Territory {
  if (!country || !NA_COUNTRIES.has(country.toUpperCase())) return "INTL";
  const north = lat >= LAT_SPLIT;
  const east = lng >= LON_SPLIT;
  if (north) return east ? "NE" : "NW";
  return east ? "SE" : "SW";
}

/** Assign a quadrant from a closest-major-city name (via CITY_GEO). */
export function territoryFromCity(city: string | null | undefined): Territory {
  if (!city) return "INTL";
  const geo = CITY_GEO[city];
  if (!geo) return "INTL";
  return territoryFromCoords(geo.lat, geo.lng, geo.country);
}

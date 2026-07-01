import { CITY_GEO } from "./cities";

/**
 * The four Community Manager regions, defined by an explicit list of US states
 * (+ two Canadian provinces). This REPLACED the old lat/lng "geographic
 * quadrant" model — regions are now assigned by a member's home state, not by
 * coordinates, so they line up exactly with each CM's book of business.
 *
 * Source of truth: the CM regions doc. Anything we can't place in a region
 * (international members, Canadian provinces outside BC/AB, unmapped cities)
 * falls into OTHER.
 */
export const TERRITORIES = ["NE", "CENTRAL", "WEST", "SE", "OTHER"] as const;
export type Territory = (typeof TERRITORIES)[number];

export const TERRITORY_LABEL: Record<Territory, string> = {
  NE: "Northeast",
  CENTRAL: "Central",
  WEST: "West",
  SE: "Southeast",
  OTHER: "Other / Intl",
};

/** The community manager who owns each region (OTHER is unassigned). */
export const TERRITORY_CM: Record<Territory, string | null> = {
  NE: "Angelica",
  CENTRAL: "Brandy",
  WEST: "Bridget",
  SE: "Sean",
  OTHER: null,
};

export const TERRITORY_ORDER: Territory[] = ["NE", "CENTRAL", "WEST", "SE", "OTHER"];

export const TERRITORY_COLOR: Record<Territory, string> = {
  NE: "#8ab4ff",
  CENTRAL: "#facc15",
  WEST: "#a78bfa",
  SE: "#22c55e",
  OTHER: "#6a7da0",
};

/**
 * State / province code → region. Keys are 2-letter codes as stored in
 * CITY_GEO.state. NOTE: "NE" here is the STATE Nebraska (→ Central), not the
 * Northeast region — the collision is harmless because keys are state codes.
 */
export const STATE_TO_REGION: Record<string, Territory> = {
  // Northeast — Angelica
  VA: "NE", MD: "NE", DC: "NE", DE: "NE", WV: "NE", NY: "NE", NJ: "NE",
  CT: "NE", RI: "NE", MA: "NE", NH: "NE", VT: "NE", ME: "NE", PA: "NE",
  OH: "NE", MI: "NE",
  // Central — Brandy  (NE = Nebraska)
  TX: "CENTRAL", OK: "CENTRAL", LA: "CENTRAL", AR: "CENTRAL", KS: "CENTRAL",
  MO: "CENTRAL", IL: "CENTRAL", IA: "CENTRAL", NE: "CENTRAL", ND: "CENTRAL",
  SD: "CENTRAL", WI: "CENTRAL", MN: "CENTRAL",
  // West — Bridget  (+ Canadian BC / AB)
  AZ: "WEST", CA: "WEST", NM: "WEST", NV: "WEST", CO: "WEST", UT: "WEST",
  ID: "WEST", MT: "WEST", WY: "WEST", OR: "WEST", WA: "WEST",
  BC: "WEST", AB: "WEST",
  // Southeast — Sean
  AL: "SE", FL: "SE", GA: "SE", MS: "SE", NC: "SE", SC: "SE", TN: "SE",
  // States not in the CM doc, assigned by geography so no domestic member
  // falls into OTHER. With these, all 50 states + DC are covered.
  IN: "CENTRAL", // Indiana → Central
  KY: "SE", // Kentucky → Southeast
  HI: "WEST", // Hawaii → West
  AK: "WEST", // Alaska → West
};

/** Region from a 2-letter state/province code. Unknown → OTHER. */
export function regionFromState(state: string | null | undefined): Territory {
  if (!state) return "OTHER";
  return STATE_TO_REGION[state.toUpperCase()] ?? "OTHER";
}

/** Assign a region from a closest-major-city name (via CITY_GEO → state). */
export function territoryFromCity(city: string | null | undefined): Territory {
  if (!city) return "OTHER";
  const geo = CITY_GEO[city];
  if (!geo) return "OTHER";
  return regionFromState(geo.state);
}

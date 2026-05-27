import rawList from "./data/fortune2000.json";

/**
 * Fortune 2000 membership check by company name. The seed list in
 * data/fortune2000.json is a starter — expand it (or swap for the full
 * Fortune 2000) without touching this logic. Matching is normalized:
 * lowercase, punctuation stripped, common corporate suffixes removed, so
 * "Cisco Systems, Inc." matches "Cisco".
 *
 * NOTE: name-matching is inherently fuzzy (e.g. "Google" vs "Alphabet").
 * This is a v1 heuristic; a future version could match on HubSpot company
 * domain or a curated alias map.
 */

const SUFFIXES = [
  "inc", "incorporated", "llc", "llp", "lp", "ltd", "limited", "corp",
  "corporation", "co", "company", "plc", "group", "holdings", "holding",
  "international", "worldwide", "global", "the",
];

export function normalizeCompany(name: string | null | undefined): string {
  if (!name) return "";
  let s = name.toLowerCase();
  s = s.replace(/&/g, " and ");
  s = s.replace(/[^a-z0-9 ]/g, " "); // strip punctuation
  let tokens = s.split(/\s+/).filter(Boolean);
  // Drop trailing/leading corporate suffix tokens.
  tokens = tokens.filter((t) => !SUFFIXES.includes(t));
  return tokens.join(" ").trim();
}

const FORTUNE_SET: Set<string> = new Set(
  (rawList as string[]).map(normalizeCompany).filter(Boolean)
);

export function isFortune2000(company: string | null | undefined): boolean {
  const n = normalizeCompany(company);
  if (!n) return false;
  return FORTUNE_SET.has(n);
}

export const FORTUNE_SET_SIZE = FORTUNE_SET.size;

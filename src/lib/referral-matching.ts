/**
 * Pure matching logic for the onboarding form's free-text "Referred/Invited
 * By" field: who, if anyone, does a raw string name? No database access, so
 * it is unit-tested (referral-matching.test.ts); sync/referrals.ts feeds it
 * the roster and staff list and persists the result.
 *
 * Outcomes:
 *   staff      a Confide staff member (tracked, earns no engagement credit)
 *   member     exactly one roster member (earns Connector credit)
 *   ambiguous  names one person, but the roster holds 2+ rows with that name
 *              (duplicate contacts upstream; fix them in HubSpot)
 *   unmatched  no single person found
 *   ignored    not a person at all ("n/a", "already a member", ...)
 */

export type ReferralStatus = "staff" | "member" | "ambiguous" | "unmatched" | "ignored";

const SUFFIXES = new Set(["jr", "sr", "ii", "iii", "iv"]);

/**
 * Lowercase, strip accents and punctuation, drop generational suffixes,
 * collapse whitespace. "Víctor  Chang Jr." → "victor chang".
 * "@" and separators become spaces so an email or a list still yields words.
 */
export function normalizeName(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[.,'"()@;:/&|\-–—+]/g, " ")
    .split(/\s+/)
    .filter((t) => t && !SUFFIXES.has(t))
    .join(" ")
    .trim();
}

/**
 * Common nickname → formal first name. Only unambiguous ones: names like
 * Alex, Sam, Pat, Chris or Jamie are left out because they shorten more than
 * one name (Alexander / Alexandra), and a wrong guess credits the wrong
 * person. A match must still be unique on the whole name.
 */
const NICKNAMES: Record<string, string> = {
  mike: "michael", mick: "michael", mikey: "michael",
  dave: "david",
  dan: "daniel", danny: "daniel",
  patti: "patricia", patty: "patricia", trish: "patricia",
  rob: "robert", bob: "robert", bobby: "robert", robbie: "robert", bert: "robert",
  rich: "richard", rick: "richard", ricky: "richard", dick: "richard",
  randy: "randolph", randall: "randolph",
  steve: "stephen", steven: "stephen",
  will: "william", bill: "william", billy: "william",
  matt: "matthew", mat: "matthew",
  greg: "gregory",
  jim: "james", jimmy: "james",
  tom: "thomas", tommy: "thomas",
  joe: "joseph", joey: "joseph",
  tony: "anthony",
  andy: "andrew", drew: "andrew",
  ben: "benjamin",
  nick: "nicholas",
  jeff: "jeffrey",
  jon: "jonathan",
  ken: "kenneth", kenny: "kenneth",
  larry: "lawrence",
  ron: "ronald",
  don: "donald",
  pete: "peter",
  ed: "edward", eddie: "edward",
  kate: "katherine", katie: "katherine", kathy: "katherine",
  liz: "elizabeth", beth: "elizabeth",
  jen: "jennifer", jenny: "jennifer",
  sue: "susan",
  deb: "deborah", debbie: "deborah",
  cindy: "cynthia",
  phil: "philip",
  fred: "frederick",
  josh: "joshua",
  zach: "zachary",
  tim: "timothy",
  jake: "jacob",
  charlie: "charles", chuck: "charles",
  doug: "douglas",
  brad: "bradley",
  russ: "russell",
  ray: "raymond",
  vince: "vincent",
};

/** Canonical form: every token's nickname replaced by its formal name. */
export function canonical(norm: string): string {
  return norm
    .split(" ")
    .map((t) => NICKNAMES[t] ?? t)
    .join(" ");
}

const JUNK_EXACT = new Set([
  "", "n a", "na", "none", "no", "self", "myself", "me", "unknown",
  "linkedin", "google", "website", "web", "internet", "email",
]);

/** Phrases that describe a channel or a situation, never a person. */
const NOT_A_PERSON =
  /\b(ciso ?society|already a member|on my own|slack|community|group|huddle|summit|conference|event|chapter|newsletter|podcast|search)\b/;

export type PersonIndex = {
  /** canonical multi-word name → staff id */
  staff: Map<string, string>;
  /** exact single-word staff aliases ("sean"), matched only as the whole string */
  staffAliases: Map<string, string>;
  /** canonical name → member ids (2+ = duplicate roster rows) */
  members: Map<string, string[]>;
};

export function buildPersonIndex(
  staffRows: { id: string; name: string; aliases: string[] | null }[],
  memberRows: { id: string; name: string | null }[]
): PersonIndex {
  const staff = new Map<string, string>();
  const staffAliases = new Map<string, string>();
  for (const s of staffRows) {
    for (const n of [s.name, ...(s.aliases ?? [])]) {
      const norm = normalizeName(n);
      if (!norm) continue;
      if (norm.includes(" ")) staff.set(canonical(norm), s.id);
      else staffAliases.set(norm, s.id);
    }
  }
  const members = new Map<string, string[]>();
  for (const m of memberRows) {
    if (!m.name) continue;
    const norm = normalizeName(m.name);
    if (!norm.includes(" ")) continue; // single-word names are too ambiguous to search for
    const key = canonical(norm);
    members.set(key, [...(members.get(key) ?? []), m.id]);
  }
  return { staff, staffAliases, members };
}

export type Classification = {
  status: ReferralStatus;
  normalized: string;
  referrerMemberId: string | null;
  referrerStaffId: string | null;
};

/** Every known full name that appears as whole words inside `text`. */
function namesIn(text: string, index: PersonIndex): Set<string> {
  const padded = ` ${text} `;
  const found = new Set<string>();
  for (const key of index.staff.keys()) if (padded.includes(` ${key} `)) found.add(key);
  for (const key of index.members.keys()) if (padded.includes(` ${key} `)) found.add(key);
  return found;
}

export function classifyReferrer(raw: string, index: PersonIndex): Classification {
  const normalized = normalizeName(raw);
  const result = (
    status: ReferralStatus,
    referrerMemberId: string | null = null,
    referrerStaffId: string | null = null
  ): Classification => ({ status, normalized, referrerMemberId, referrerStaffId });

  if (JUNK_EXACT.has(normalized)) return result("ignored");

  // A bare first name only counts if it is a staff alias ("sean", "larry").
  const alias = index.staffAliases.get(normalized);
  if (alias) return result("staff", null, alias);

  const text = canonical(normalized);
  let keys = namesIn(text, index);

  // Middle names: "parminder singh sahi" → try "parminder sahi".
  if (keys.size === 0) {
    const tokens = text.split(" ");
    if (tokens.length === 3 || tokens.length === 4) {
      keys = namesIn(`${tokens[0]} ${tokens[tokens.length - 1]}`, index);
    }
  }

  if (keys.size === 1) {
    const [key] = [...keys];
    // Staff wins: a staffer who is also on the roster must earn no credit.
    const staffId = index.staff.get(key);
    if (staffId) return result("staff", null, staffId);
    const ids = index.members.get(key) ?? [];
    if (ids.length === 1) return result("member", ids[0]);
    return result("ambiguous");
  }

  if (keys.size === 0 && NOT_A_PERSON.test(normalized)) return result("ignored");
  return result("unmatched"); // nobody, or several people named in one answer
}

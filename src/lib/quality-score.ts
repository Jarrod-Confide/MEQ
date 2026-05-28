// Quality scoring — a weighted, explainable 0–100 score for "how high-value
// a member is" based on their employer + role. Mirrors the engagement
// framework's philosophy: tunable weights, deterministic, debuggable.
// v1 starting point — tune the maps/weights freely.

export const QUALITY_WEIGHTS = {
  prominence: 0.35, // employer significance
  authority: 0.3, // seniority + reporting line
  team: 0.2, // team scope
  employment: 0.15, // employment status
} as const;

// company_size enum (company object) + numemployees fallback ranges → score.
const SIZE_SCORE: Record<string, number> = {
  "10,000+": 90,
  "5,001-10,000": 80,
  "1,001-5,000": 70,
  "501-1,000": 55,
  "201-500": 40,
  "1-200": 25,
  "Just Me (Solo)": 5,
  "N/A": 0,
  // contact-level numemployees fallback buckets
  "1000+": 90,
  "500-1000": 80,
  "100-500": 70,
  "50-100": 45,
  "25-50": 30,
  "5-25": 20,
  "1-5": 10,
};

const SENIORITY_SCORE: Record<string, number> = {
  "C-Level": 100,
  owner: 85,
  partner: 85,
  vp: 70,
  director: 50,
  manager: 30,
  "In Transition": 0,
  "N/A": 0,
};

const REPORTING_SCORE: Record<string, number> = {
  CEO: 100,
  Board: 100,
  CIO: 70,
  CTO: 70,
  CFO: 70,
  COO: 70,
  "General Council": 60,
  CISO: 50,
  "None of the Above": 0,
  "N/A": 0,
};

const TEAM_SCORE: Record<string, number> = {
  "100+": 100,
  "51-100": 85,
  "31-50": 70,
  "16-30": 55,
  "6-15": 40,
  "1-5": 25,
  "Just Me (Solo)": 5,
  "N/A": 0,
};

const EMPLOYMENT_SCORE: Record<string, number> = {
  employed: 100,
  self_employed: 50,
  in_transition: 20,
  unknown: 50, // neutral — don't penalize missing CRM data
};

export type QualityInput = {
  companySize: string | null;
  isFortune2000: boolean;
  seniority: string | null;
  reportingTo: string | null;
  teamSize: string | null;
  employmentType: string | null;
};

export type QualityResult = {
  score: number;
  tier: QualityTier;
  prominence: number;
  authority: number;
  team: number;
  employment: number;
};

export const QUALITY_TIERS = ["Platinum", "Gold", "Silver", "Bronze", "Unranked"] as const;
export type QualityTier = (typeof QUALITY_TIERS)[number];

const clamp = (n: number) => Math.max(0, Math.min(100, n));

function tierFor(score: number): QualityTier {
  if (score >= 80) return "Platinum";
  if (score >= 60) return "Gold";
  if (score >= 40) return "Silver";
  if (score >= 20) return "Bronze";
  return "Unranked";
}

export function computeQuality(i: QualityInput): QualityResult {
  const sizeScore = i.companySize ? SIZE_SCORE[i.companySize] ?? 0 : 0;
  // Fortune 2000 is the strongest prominence signal — floors prominence high.
  const prominence = i.isFortune2000 ? Math.max(90, sizeScore) : sizeScore;

  const sen = i.seniority ? SENIORITY_SCORE[i.seniority] ?? 0 : 0;
  const rep = i.reportingTo ? REPORTING_SCORE[i.reportingTo] ?? 0 : 0;
  const authority = clamp(0.6 * sen + 0.4 * rep);

  const team = i.teamSize ? TEAM_SCORE[i.teamSize] ?? 0 : 0;
  const employment = EMPLOYMENT_SCORE[i.employmentType ?? "unknown"] ?? 50;

  const score = Math.round(
    QUALITY_WEIGHTS.prominence * prominence +
      QUALITY_WEIGHTS.authority * authority +
      QUALITY_WEIGHTS.team * team +
      QUALITY_WEIGHTS.employment * employment
  );

  return {
    score,
    tier: tierFor(score),
    prominence: Math.round(prominence),
    authority: Math.round(authority),
    team: Math.round(team),
    employment: Math.round(employment),
  };
}

// Plain shared constants (no "use client", no server deps) so both the
// server-rendered /quality page and the client QualityTable can import them.
// A server component cannot read values exported from a "use client" module.

export const QUALITY_TIER_ORDER = ["Platinum", "Gold", "Silver", "Bronze", "Unranked"];

export const TIER_COLOR: Record<string, string> = {
  Platinum: "#c4b5fd",
  Gold: "#fbbf24",
  Silver: "#cbd5e1",
  Bronze: "#d8956b",
  Unranked: "#6a7da0",
};

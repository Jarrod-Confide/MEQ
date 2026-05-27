import type { Tier, Dimension } from "@/lib/engagement";

export const TIER_COLOR: Record<Tier, string> = {
  Champion: "#a78bfa",
  Active: "#22c55e",
  Engaged: "#60a5fa",
  Light: "#facc15",
  Dormant: "#6a7da0",
};

export const DIMENSION_LABEL: Record<Dimension, string> = {
  presence: "Presence",
  contribution: "Contribution",
  reciprocity: "Reciprocity",
  reach: "Reach",
  depth: "Depth",
};

export function TierBadge({ tier }: { tier: Tier }) {
  return (
    <span
      className="inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold"
      style={{ background: `${TIER_COLOR[tier]}22`, color: TIER_COLOR[tier] }}
    >
      {tier}
    </span>
  );
}

export function DimBar({ value, color }: { value: number; color: string }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#1a2238]">
      <div
        className="h-full rounded-full"
        style={{ width: `${Math.max(2, value)}%`, background: color }}
      />
    </div>
  );
}

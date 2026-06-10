import { DIMENSION_WEIGHTS, type Dimension } from "@/lib/engagement";
import { DIMENSION_LABEL, TIER_COLOR } from "@/components/engagement-ui";

const DIMENSION_DEF: Record<Dimension, string> = {
  events:
    "In-person attendance at CISO Society events (decayed over time). The single strongest signal — this is a relationship-first community.",
  contribution:
    "Substance-weighted original posts you start — questions, insights, resources shared with the group. Measures the quality of what you put into the room, not how often you post.",
  reciprocity:
    "Substantive replies and answers to other members, plus reactions you give. Rewards showing up for peers and helping the people who ask.",
  depth:
    "The average substance of your messages — are your contributions consistently thoughtful? Evidence-smoothed, so a single great post can't max it and a stream of “thanks!” can't fake it.",
  reach:
    "How much your content lands — reactions and replies it draws from others. A signal of resonance and influence in the community.",
  presence:
    "Consistency — the number of distinct days you show up and engage online, rather than one big burst of activity.",
  connector:
    "Community-building: job postings and member introductions. Valuable glue, but deliberately capped so it doesn't masquerade as subject-matter contribution.",
};

const CONCEPTS: { term: string; def: string }[] = [
  {
    term: "Substance score",
    def: "Every Slack/Circle message is scored 0–10 by an LLM rubric tuned to a CISO audience — so a detailed answer outweighs a one-word reply. This content weight (not raw volume) drives Contribution & Reciprocity.",
  },
  {
    term: "90-day decay half-life",
    def: "Recent activity counts most. A contribution's weight halves roughly every 90 days, so the score reflects how engaged someone is now.",
  },
  {
    term: "Normalized to the 95th percentile",
    def: "Each dimension is scaled 0–100 against a top (95th-percentile) member, so scores are comparable across dimensions of very different raw sizes.",
  },
  {
    term: "Tiers",
    def: "Members are ranked by total score into Champion (top 10%) · Active · Engaged · Light · Dormant. Tiers are relative, so roughly the top tenth are always Champions.",
  },
];

const ORDER = Object.keys(DIMENSION_WEIGHTS) as Dimension[];

/** Expandable plain-English definitions of the engagement algorithm. */
export function AlgorithmInfo() {
  return (
    <details className="mb-4 max-w-prose rounded-lg border border-[#1f2a3d] bg-[#0b0f17]">
      <summary className="cursor-pointer select-none px-4 py-2.5 text-[12px] text-[#8ab4ff] hover:text-white">
        What do these mean? · dimension definitions
      </summary>
      <div className="border-t border-[#1f2a3d] px-4 py-3">
        <ul className="space-y-2.5">
          {ORDER.map((d) => (
            <li key={d} className="text-[12px] leading-relaxed">
              <span className="font-semibold text-[#cfdaee]">{DIMENSION_LABEL[d]}</span>
              <span className="ml-1.5 rounded bg-[#1a2238] px-1.5 py-0.5 text-[10px] tabular-nums text-[#9bb0d4]">
                {Math.round(DIMENSION_WEIGHTS[d] * 100)}%
              </span>
              <span className="ml-2 text-[#9bb0d4]">{DIMENSION_DEF[d]}</span>
            </li>
          ))}
        </ul>
        <div className="my-3 border-t border-[#1f2a3d]" />
        <ul className="space-y-2.5">
          {CONCEPTS.map((c) => (
            <li key={c.term} className="text-[12px] leading-relaxed">
              <span className="font-semibold text-[#cfdaee]">{c.term}</span>
              <span className="ml-2 text-[#9bb0d4]">{c.def}</span>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex flex-wrap gap-3 border-t border-[#1f2a3d] pt-3">
          {(["Champion", "Active", "Engaged", "Light", "Dormant"] as const).map((t) => (
            <span key={t} className="flex items-center gap-1.5 text-[11px] text-[#9bb0d4]">
              <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: TIER_COLOR[t] }} />
              {t}
            </span>
          ))}
        </div>
      </div>
    </details>
  );
}

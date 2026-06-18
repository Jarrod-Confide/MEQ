import Link from "next/link";
import { WINDOWS } from "@/lib/engagement-cache";
import { getFullLeaderboard } from "@/lib/leaderboard";
import { TIERS } from "@/lib/engagement";
import { EngagementTable } from "@/components/EngagementTable";
import { RefreshButton } from "@/components/RefreshButton";
import { TIER_COLOR } from "@/components/engagement-ui";
import { fetchQualityByEventflowId } from "@/lib/quality-data";
import { fetchFlagByEventflowId } from "@/lib/members";
import { Nav } from "@/components/Nav";
import { AlgorithmInfo } from "@/components/AlgorithmInfo";

export const dynamic = "force-dynamic";

export default async function EngagementPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  const { days: daysParam } = await searchParams;
  const days = WINDOWS.some((w) => String(w.days) === daysParam)
    ? Number(daysParam)
    : 90;
  const [data, qualityByEf, flagByEf] = await Promise.all([
    getFullLeaderboard(days),
    fetchQualityByEventflowId(),
    fetchFlagByEventflowId(),
  ]);
  const activePct = data.total ? Math.round((data.activeCount / data.total) * 100) : 0;

  // Decorate each member with quality + country flag (when matched to a contact).
  const enrichedMembers = data.members.map((m) => {
    if (m.key.startsWith("c:")) {
      const ef = m.key.slice(2);
      const q = qualityByEf.get(ef);
      return {
        ...m,
        qualityScore: q?.score ?? null,
        qualityTier: q?.tier ?? null,
        flag: flagByEf.get(ef) ?? null,
      };
    }
    return m;
  });

  return (
    <div className="min-h-screen">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[#1f2a3d] bg-[#111726] px-6 py-4">
        <div>
          <div className="text-[12px] uppercase tracking-[0.05em] text-[#9bb0d4]">
            MEQ · Member Engagement and Quality
          </div>
          <h1 className="m-0 text-xl font-semibold">Engagement Leaderboard</h1>
        </div>
        <Nav current="/engagement" />
        <RefreshButton computedAt={data.computedAt} />
      </header>

      <main className="px-6 py-5">
        {/* Controls + dashboard */}
        <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-[12px] uppercase tracking-wide text-[#9bb0d4]">
              Window
            </span>
            {WINDOWS.map((w) => (
              <Link
                key={w.days}
                href={`/engagement?days=${w.days}`}
                className={`rounded-md px-2.5 py-1 text-[13px] ${
                  w.days === days
                    ? "bg-[#8ab4ff] text-[#0b0f17]"
                    : "border border-[#2d3d5c] text-[#9bb0d4] hover:text-white"
                }`}
              >
                {w.label}
              </Link>
            ))}
          </div>
          <div className="flex flex-wrap gap-4 text-[13px]">
            <span title="members with any activity in this window">
              <b className="mr-1 text-base text-[#8ab4ff]">{data.activeCount}</b>
              active
              <span className="ml-1 text-[#6a7da0]">of {data.total.toLocaleString()} ({activePct}%)</span>
            </span>
            {TIERS.map((t) => (
              <span key={t} className="flex items-center gap-1.5">
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full"
                  style={{ background: TIER_COLOR[t] }}
                />
                <b className="tabular-nums text-white">{data.tierCounts[t]}</b>
                <span className="text-[#9bb0d4]">{t}</span>
              </span>
            ))}
          </div>
        </div>

        <p className="mb-4 max-w-prose text-[12px] leading-relaxed text-[#6a7da0]">
          Composite of 7 dimensions, events-weighted:{" "}
          <b className="text-[#9bb0d4]">Events 32%</b> · Contribution 20% ·
          Reciprocity 16% · Depth 12% · Reach 10% · Presence 5% · Connector 5%.
          Every Slackle message is scored 0–10 for{" "}
          <b className="text-[#9bb0d4]">substance</b> by an LLM rubric tuned to a
          CISO audience, so a detailed answer outweighs &ldquo;thanks!&rdquo; —
          content weight, not volume, drives Contribution &amp; Reciprocity.
          Depth = evidence-smoothed average substance (consistent quality, not a
          single great post). Connector = job posts + member intros. 90-day
          decay half-life; dimensions normalized to the 95th-percentile member.
        </p>

        <AlgorithmInfo />

        <EngagementTable members={enrichedMembers} />
      </main>
    </div>
  );
}

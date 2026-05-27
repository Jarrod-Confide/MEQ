import Link from "next/link";
import { getEngagement, WINDOWS } from "@/lib/engagement-cache";
import { TIERS } from "@/lib/engagement";
import { EngagementTable } from "@/components/EngagementTable";
import { RefreshButton } from "@/components/RefreshButton";
import { TIER_COLOR } from "@/components/engagement-ui";

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
  const data = await getEngagement(days);

  return (
    <div className="min-h-screen">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[#1f2a3d] bg-[#111726] px-6 py-4">
        <div>
          <div className="text-[12px] uppercase tracking-[0.05em] text-[#9bb0d4]">
            MEQ · Member Engagement and Quality
          </div>
          <h1 className="m-0 text-xl font-semibold">Engagement Leaderboard</h1>
        </div>
        <nav className="flex gap-1">
          <Link
            href="/"
            className="rounded-md px-3 py-1.5 text-[13px] text-[#9bb0d4] hover:bg-[#1a2238] hover:text-white"
          >
            Map
          </Link>
          <Link
            href="/engagement"
            className="rounded-md border border-[#2d3d5c] bg-[#1a2238] px-3 py-1.5 text-[13px] text-white"
          >
            Engagement
          </Link>
          <Link
            href="/quality"
            className="rounded-md px-3 py-1.5 text-[13px] text-[#9bb0d4] hover:bg-[#1a2238] hover:text-white"
          >
            Quality
          </Link>
        </nav>
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
            <span>
              <b className="mr-1 text-base text-[#8ab4ff]">{data.scoredCount}</b>
              scored
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
          Composite of 5 dimensions (Presence · Contribution · Reciprocity ·
          Reach · Depth) from Slackle messages + reactions and EventFlow
          attendance, with a 90-day decay half-life. Dimension scores are
          normalized to the 95th-percentile member. Speaking weight is wired
          but scores 0 until speakers are linked to contacts in EventFlow.
        </p>

        <EngagementTable members={data.members} />
      </main>
    </div>
  );
}

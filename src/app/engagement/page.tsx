import Link from "next/link";
import { WINDOWS } from "@/lib/engagement-cache";
import { getFullLeaderboard } from "@/lib/leaderboard";
import { TIERS } from "@/lib/engagement";
import { EngagementTable } from "@/components/EngagementTable";
import { RefreshButton } from "@/components/RefreshButton";
import { TIER_COLOR } from "@/components/engagement-ui";
import { fetchQualityByEventflowId } from "@/lib/quality-data";
import { fetchFlagByEventflowId } from "@/lib/members";
import { AlgorithmInfo } from "@/components/AlgorithmInfo";
import { getJoinedMembers } from "@/lib/new-members-data";

const JOINED_PRESETS = [
  { key: "30", label: "Last 30 days" },
  { key: "90", label: "Last 90 days" },
  { key: "180", label: "Last 6 months" },
  { key: "365", label: "Last year" },
] as const;

/** ?joined=N (last N days) or ?since=YYYY-MM-DD → the earliest join date to keep, or null for everyone. */
function joinedCutoff(joined: string | undefined, since: string | undefined): Date | null {
  if (since && /^\d{4}-\d{2}-\d{2}$/.test(since)) {
    const d = new Date(`${since}T00:00:00Z`);
    if (!isNaN(d.getTime())) return d;
  }
  const n = Number(joined);
  if (JOINED_PRESETS.some((p) => p.key === joined) && n > 0) return new Date(Date.now() - n * 86400000);
  return null;
}

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export default async function EngagementPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string; joined?: string; since?: string }>;
}) {
  const { days: daysParam, joined, since } = await searchParams;
  const days = WINDOWS.some((w) => String(w.days) === daysParam)
    ? Number(daysParam)
    : 90;
  const cutoff = joinedCutoff(joined, since);
  const [data, qualityByEf, flagByEf, joinedMembers] = await Promise.all([
    getFullLeaderboard(days),
    fetchQualityByEventflowId(),
    fetchFlagByEventflowId(),
    cutoff ? getJoinedMembers() : Promise.resolve([]),
  ]);
  // Members who joined on or after the cutoff (by EventFlow contact id).
  const recentEf = cutoff
    ? new Set(joinedMembers.filter((m) => m.efId && new Date(m.joinedAt) >= cutoff).map((m) => m.efId as string))
    : null;
  const joinedQs = since ? `&since=${since}` : joined ? `&joined=${joined}` : "";
  const activePct = data.total ? Math.round((data.activeCount / data.total) * 100) : 0;

  // Decorate each member with quality + country flag (when matched to a contact).
  const enrichedMembers = data.members
    .filter((m) => !recentEf || (m.key.startsWith("c:") && recentEf.has(m.key.slice(2))))
    .map((m) => {
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
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[#1f2a3d] bg-[#111726] px-4 py-4 md:px-6">
        <div>
          <div className="text-[12px] uppercase tracking-[0.05em] text-[#9bb0d4]">
            MEQ · Member Engagement and Quality
          </div>
          <h1 className="m-0 text-xl font-semibold">Engagement Leaderboard</h1>
        </div>
        <RefreshButton computedAt={data.computedAt} />
      </header>

      <main className="px-4 py-5 md:px-6">
        {/* Controls + dashboard */}
        <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-[12px] uppercase tracking-wide text-[#9bb0d4]">
              Window
            </span>
            {WINDOWS.map((w) => (
              <Link
                key={w.days}
                prefetch={false}
                href={`/engagement?days=${w.days}${joinedQs}`}
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
          <b className="text-[#9bb0d4]">Events 30%</b> · Contribution 18% ·
          Reciprocity 15% · Depth 12% · Reach 10% · Connector 10% · Presence 5%.
          Every Slackle message is scored 0–10 for{" "}
          <b className="text-[#9bb0d4]">substance</b> by an LLM rubric tuned to a
          CISO audience, so a detailed answer outweighs &ldquo;thanks!&rdquo; —
          content weight, not volume, drives Contribution &amp; Reciprocity.
          Depth = evidence-smoothed average substance (consistent quality, not a
          single great post). Connector = member referrals + job posts + intros
          (staff referrals excluded). 90-day decay half-life; dimensions
          normalized to the 95th-percentile member.
        </p>

        {/* Joined filter */}
        <div className="mb-5 flex flex-wrap items-end gap-2 text-[12px]">
          <span className="mb-1.5 mr-1 text-[12px] uppercase tracking-wide text-[#9bb0d4]">Joined</span>
          <JoinedChip href={`/engagement?days=${days}`} active={!cutoff} label="Any time" />
          {JOINED_PRESETS.map((p) => (
            <JoinedChip key={p.key} href={`/engagement?days=${days}&joined=${p.key}`} active={!since && joined === p.key} label={p.label} />
          ))}
          <form action="/engagement" className="flex items-end gap-2">
            <input type="hidden" name="days" value={days} />
            <label className="text-[11px] uppercase tracking-wide text-[#9bb0d4]">
              Since
              <input
                type="date"
                name="since"
                defaultValue={since ?? ""}
                className="mt-1 block rounded-md border border-[#2d3d5c] bg-[#0b0f17] px-2 py-1 text-[13px] text-white [color-scheme:dark]"
              />
            </label>
            <button type="submit" className="rounded-md border border-[#2d3d5c] px-2.5 py-1 text-[13px] text-[#8ab4ff] hover:bg-[#1a2238]">Apply</button>
          </form>
          {cutoff && (
            <span className="mb-1.5 ml-2 text-[#9bb0d4]">
              <b className="text-white">{enrichedMembers.length}</b> members joined since {cutoff.toISOString().slice(0, 10)}
            </span>
          )}
        </div>

        <AlgorithmInfo />

        <EngagementTable members={enrichedMembers} />
      </main>
    </div>
  );
}

function JoinedChip({ href, active, label }: { href: string; active: boolean; label: string }) {
  return (
    <Link
      href={href}
      prefetch={false}
      className={
        active
          ? "rounded-md border border-[#8ab4ff] bg-[#1a2238] px-2.5 py-1 text-white"
          : "rounded-md border border-[#2d3d5c] px-2.5 py-1 text-[#9bb0d4] hover:bg-[#1a2238] hover:text-white"
      }
    >
      {label}
    </Link>
  );
}

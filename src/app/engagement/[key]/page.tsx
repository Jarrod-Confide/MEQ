import Link from "next/link";
import { notFound } from "next/navigation";
import { getMemberDetail } from "@/lib/member-detail";
import { WINDOWS } from "@/lib/engagement-cache";
import { DIMENSION_WEIGHTS, type Dimension } from "@/lib/engagement";
import { TierBadge, DimBar, TIER_COLOR, DIMENSION_LABEL } from "@/components/engagement-ui";

export const dynamic = "force-dynamic";

const DIMS = Object.keys(DIMENSION_WEIGHTS) as Dimension[];

export default async function MemberDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ key: string }>;
  searchParams: Promise<{ days?: string }>;
}) {
  const { key } = await params;
  const { days: daysParam } = await searchParams;
  const days = WINDOWS.some((w) => String(w.days) === daysParam)
    ? Number(daysParam)
    : 90;

  const detail = await getMemberDetail(decodeURIComponent(key), days);
  if (!detail) notFound();
  const { score, emails, recentMessages, events } = detail;

  const stat = (label: string, value: number | string) => (
    <div className="rounded-lg border border-[#1f2a3d] bg-[#111726] px-4 py-3">
      <div className="text-[20px] font-semibold tabular-nums text-white">{value}</div>
      <div className="text-[11px] uppercase tracking-wide text-[#9bb0d4]">{label}</div>
    </div>
  );

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <Link
        href={`/engagement?days=${days}`}
        className="text-[12px] uppercase tracking-[0.05em] text-[#9bb0d4] hover:text-white"
      >
        ← Back to leaderboard
      </Link>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <h1 className="m-0 text-2xl font-semibold">{score.name}</h1>
        <TierBadge tier={score.tier} />
        {!score.matched && (
          <span className="text-[11px] text-[#6a7da0]">
            slack-only (no EventFlow match)
          </span>
        )}
      </div>
      <div className="mt-1 text-[13px] text-[#9bb0d4]">
        {score.email ?? "no email"}
        {emails.length > 1 && (
          <span className="text-[#6a7da0]"> · {emails.length} linked emails</span>
        )}
        {score.hubspotContactId && (
          <span className="text-[#6a7da0]"> · HS {score.hubspotContactId}</span>
        )}
      </div>

      <div className="mt-5 flex items-baseline gap-3">
        <span className="text-5xl font-bold tabular-nums text-[#8ab4ff]">
          {score.total.toFixed(1)}
        </span>
        <span className="text-[13px] text-[#9bb0d4]">composite score (0–100)</span>
      </div>

      {/* Dimension breakdown */}
      <h2 className="mb-3 mt-8 text-[13px] uppercase tracking-wide text-[#9bb0d4]">
        Dimensions
      </h2>
      <div className="space-y-2.5">
        {DIMS.map((d) => (
          <div key={d} className="flex items-center gap-3">
            <span className="w-28 shrink-0 text-[13px] text-[#cfdaee]">
              {DIMENSION_LABEL[d]}
            </span>
            <span className="w-9 shrink-0 text-[11px] text-[#6a7da0]">
              ×{DIMENSION_WEIGHTS[d]}
            </span>
            <DimBar value={score.dimensions[d]} color={TIER_COLOR[score.tier]} />
            <span className="w-10 shrink-0 text-right tabular-nums text-[13px] text-white">
              {score.dimensions[d].toFixed(0)}
            </span>
          </div>
        ))}
      </div>

      {/* Raw signal counts */}
      <h2 className="mb-3 mt-8 text-[13px] uppercase tracking-wide text-[#9bb0d4]">
        Signals (last {days >= 9999 ? "all-time" : `${days}d`})
      </h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stat("Posts", score.signals.posts)}
        {stat("Replies", score.signals.replies)}
        {stat("Reactions given", score.signals.reactionsGiven)}
        {stat("Reactions received", score.signals.reactionsReceived)}
        {stat("Replies received", score.signals.repliesReceived)}
        {stat("Active days", score.signals.activeDays)}
        {stat("Events attended", score.signals.eventsAttended)}
        {stat("No-shows", score.signals.noShows)}
      </div>

      {/* Events */}
      {events.length > 0 && (
        <>
          <h2 className="mb-3 mt-8 text-[13px] uppercase tracking-wide text-[#9bb0d4]">
            Event history
          </h2>
          <ul className="overflow-hidden rounded-lg border border-[#1f2a3d]">
            {events.map((e, i) => (
              <li
                key={i}
                className="flex items-center justify-between border-b border-[#161e2e] bg-[#111726] px-4 py-2.5 text-[13px] last:border-b-0"
              >
                <span className="text-[#cfdaee]">{e.title}</span>
                <span className="flex items-center gap-3">
                  <span className="text-[#6a7da0]">
                    {new Date(e.startsAt).toLocaleDateString()}
                  </span>
                  <span
                    className="rounded px-1.5 py-0.5 text-[11px]"
                    style={{
                      background: e.status === "attended" ? "#22c55e22" : "#6a7da022",
                      color: e.status === "attended" ? "#22c55e" : "#9bb0d4",
                    }}
                  >
                    {e.status}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </>
      )}

      {/* Recent messages */}
      {recentMessages.length > 0 && (
        <>
          <h2 className="mb-3 mt-8 text-[13px] uppercase tracking-wide text-[#9bb0d4]">
            Recent messages
          </h2>
          <ul className="space-y-2">
            {recentMessages.map((m, i) => (
              <li
                key={i}
                className="rounded-lg border border-[#1f2a3d] bg-[#111726] px-4 py-2.5"
              >
                <div className="mb-1 flex items-center gap-2 text-[11px] text-[#6a7da0]">
                  <span className="text-[#8ab4ff]">{m.channel}</span>
                  <span>· {m.source}</span>
                  <span>· {m.isReply ? "reply" : "post"}</span>
                  <span>· {new Date(m.postedAt).toLocaleString()}</span>
                </div>
                <div className="text-[13px] leading-relaxed text-[#cfdaee]">
                  {m.preview}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

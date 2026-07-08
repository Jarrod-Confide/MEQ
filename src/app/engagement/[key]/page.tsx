import Link from "next/link";
import { notFound } from "next/navigation";
import { getMemberDetail } from "@/lib/member-detail";
import { WINDOWS } from "@/lib/engagement-cache";
import { DIMENSION_WEIGHTS, type Dimension } from "@/lib/engagement";
import { TierBadge, DimBar, TIER_COLOR, DIMENSION_LABEL } from "@/components/engagement-ui";
import { LineChart } from "@/components/charts";
import { PASSIVE_COLOR } from "@/lib/passive";
import { TIER_COLOR as QUALITY_TIER_COLOR } from "@/lib/quality-tiers";

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
  const { score, emails, recentMessages, events, trend, topics, quality, passive } = detail;

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

      <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-3">
        <div className="flex items-baseline gap-3">
          <span className="text-5xl font-bold tabular-nums text-[#8ab4ff]">
            {score.total.toFixed(1)}
          </span>
          <span className="text-[13px] text-[#9bb0d4]">engagement (0–100)</span>
        </div>
        {quality && quality.score != null && (
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold tabular-nums" style={{ color: quality.tier ? QUALITY_TIER_COLOR[quality.tier] ?? "#cfdaee" : "#cfdaee" }}>
              {quality.score}
            </span>
            <span className="text-[13px] text-[#9bb0d4]">quality{quality.tier ? ` · ${quality.tier}` : ""}</span>
          </div>
        )}
        {passive.tier && (
          <span className="rounded-full px-2.5 py-1 text-[12px] font-semibold" style={{ background: `${PASSIVE_COLOR[passive.tier]}22`, color: PASSIVE_COLOR[passive.tier] }}>
            Email: {passive.tier}{passive.clicks != null && passive.clicks > 0 ? ` · ${passive.clicks} clicks` : ""}
          </span>
        )}
      </div>

      {/* Engagement trend */}
      {trend.length > 1 && (
        <>
          <h2 className="mb-2 mt-8 text-[13px] uppercase tracking-wide text-[#9bb0d4]">
            Engagement trend (snapshots taken weekly, Mondays)
          </h2>
          <div className="rounded-lg border border-[#1f2a3d] bg-[#111726] p-3">
            <LineChart
              labels={trend.map((t) => t.week.slice(5))}
              series={[{ label: "Engagement", color: "#8ab4ff", points: trend.map((t) => t.total) }]}
              yMax={100}
            />
          </div>
        </>
      )}

      {/* Topics they post about */}
      {topics.length > 0 && (
        <>
          <h2 className="mb-2 mt-8 text-[13px] uppercase tracking-wide text-[#9bb0d4]">
            What they talk about
          </h2>
          <div className="flex flex-wrap gap-2">
            {topics.map((t) => (
              <span key={t.topic} className="rounded-full border border-[#2d3d5c] px-2.5 py-1 text-[12px] text-[#cfdaee]">
                {t.topic.replace(/_/g, " ")} <span className="text-[#6a7da0]">{t.count}</span>
              </span>
            ))}
          </div>
        </>
      )}

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
        {stat("Members referred", score.signals.referrals ?? 0)}
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
                <div className="mb-1 flex flex-wrap items-center gap-2 text-[11px] text-[#6a7da0]">
                  <span className="text-[#8ab4ff]">{m.channel}</span>
                  <span>· {m.source}</span>
                  <span>· {m.isReply ? "reply" : "post"}</span>
                  <span>· {new Date(m.postedAt).toLocaleString()}</span>
                  {m.contentWeight != null && (
                    <span
                      className="rounded px-1.5 py-0.5 font-semibold"
                      style={{ background: "#8ab4ff22", color: "#8ab4ff" }}
                      title="content substance weight (0–10)"
                    >
                      wt {m.contentWeight}
                    </span>
                  )}
                  {m.topics.map((t) => (
                    <span key={t} className="rounded bg-[#1a2238] px-1.5 py-0.5 text-[#9bb0d4]">
                      {t.replace(/_/g, " ")}
                    </span>
                  ))}
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

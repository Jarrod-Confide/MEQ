import { fetchDashboard } from "@/lib/dashboard-data";
import { QUALITY_TIER_ORDER, TIER_COLOR as QUALITY_TIER_COLOR } from "@/lib/quality-tiers";
import { TIER_COLOR as ENGAGEMENT_TIER_COLOR } from "@/components/engagement-ui";
import { TIERS } from "@/lib/engagement";
import { BarChart, LineChart } from "@/components/charts";
import Link from "next/link";
import { getViewer } from "@/lib/viewer";
import { resolveScope, scopeLabel, scopeParam, type Scope } from "@/lib/scope";
import {
  DIMENSIONS,
  TREND_METRICS,
  TREND_SPANS,
  getEngagementTrend,
  metricLabel,
  parseMetric,
  type TrendMetric,
} from "@/lib/engagement-trend";
import { TERRITORY_COLOR, TERRITORY_LABEL, TERRITORY_ORDER } from "@/lib/territory";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
export const revalidate = 300;

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ metric?: string; region?: string; span?: string }>;
}) {
  const params = await searchParams;
  // Sequential, not Promise.all: fetchDashboard already runs waves of 4, and
  // stacking more queries beside it wedges the pool (see lib/db.ts).
  const viewer = await getViewer();
  const d = await fetchDashboard();
  const metric = parseMetric(params.metric);
  const scope: Scope = resolveScope(params.region ?? "all", viewer);
  const span = TREND_SPANS.some((x) => x.key === params.span) ? (params.span as string) : "26";
  const qs = (over: Record<string, string>) => {
    const p = new URLSearchParams({ metric, region: scopeParam(scope), span, ...over });
    return `/dashboard?${p.toString()}#trend`;
  };
  const trendStr =
    d.trend30dPct == null
      ? "—"
      : `${d.trend30dPct >= 0 ? "▲" : "▼"} ${Math.abs(d.trend30dPct)}% vs prior 30d`;
  const trendColor = d.trend30dPct == null
    ? "#9bb0d4"
    : d.trend30dPct >= 0
      ? "#22c55e"
      : "#ef4444";
  const activePct = d.totalMembers
    ? Math.round((d.activeIn30d / d.totalMembers) * 100)
    : 0;

  return (
    <div className="min-h-screen">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[#1f2a3d] bg-[#111726] px-4 py-4 md:px-6">
        <div>
          <div className="text-[12px] uppercase tracking-[0.05em] text-[#9bb0d4]">
            MEQ · Member Engagement and Quality
          </div>
          <h1 className="m-0 text-xl font-semibold">Membership Overview</h1>
        </div>
        <div className="text-[11px] text-[#6a7da0]">
          {d.syncedAt ? `synced ${new Date(d.syncedAt).toLocaleString()}` : "—"}
        </div>
      </header>

      <main className="px-4 py-5 md:px-6 space-y-6">
        {/* Headline numbers */}
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
          <BigStat label="Members" value={d.totalMembers} color="#cfdaee" />
          <BigStat label="New (7d)" value={d.newIn7d} color="#8ab4ff" />
          <BigStat label="New (30d)" value={d.newIn30d} color="#8ab4ff" sub={trendStr} subColor={trendColor} />
          <BigStat label="New (90d)" value={d.newIn90d} color="#8ab4ff" />
          <BigStat
            label="Active 30d"
            value={d.activeIn30d}
            color="#22c55e"
            sub={`${activePct}% of members`}
          />
        </section>

        {/* Monthly joins chart */}
        <section className="rounded-lg border border-[#1f2a3d] bg-[#111726] p-5">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="m-0 text-[13px] uppercase tracking-wide text-[#9bb0d4]">
              New members per month
            </h2>
            <Link href="/new-members" prefetch={false} className="text-[12px] text-[#8ab4ff] hover:underline">
              By day, week or quarter →
            </Link>
          </div>
          <BarChart
            items={d.monthlyJoins.map((m) => ({
              label: `${m.month.slice(5)}/${m.month.slice(2, 4)}`,
              value: m.count,
            }))}
            height={150}
          />
        </section>

        {/* Engagement over time: pick the measure, region and span */}
        <EngagementExplorer metric={metric} scope={scope} span={span} qs={qs} />

        {/* Tier mixes */}
        <section className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          <TierMix
            title="Quality mix"
            tiers={QUALITY_TIER_ORDER}
            counts={d.qualityTierCounts}
            colorMap={QUALITY_TIER_COLOR}
            total={d.totalMembers}
          />
          <TierMix
            title="Engagement mix (90d)"
            tiers={TIERS as unknown as string[]}
            counts={d.engagementTierCounts}
            colorMap={ENGAGEMENT_TIER_COLOR as Record<string, string>}
            total={d.totalMembers}
          />
        </section>

        {/* Composition */}
        <section className="rounded-lg border border-[#1f2a3d] bg-[#111726] p-5">
          <h2 className="mb-3 text-[13px] uppercase tracking-wide text-[#9bb0d4]">
            Composition
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <CompTile label="Fortune 2000" n={d.fortune2000Count} total={d.totalMembers} color="#c4b5fd" />
            <CompTile label="C-Level" n={d.cLevelCount} total={d.totalMembers} color="#a78bfa" />
            <CompTile label="Report to CEO" n={d.reportsToCeoCount} total={d.totalMembers} color="#60a5fa" />
            <CompTile label="Large company (1,001+)" n={d.largeCompanyCount} total={d.totalMembers} color="#22c55e" />
            <CompTile label="Self-employed (vCISO)" n={d.vCISOCount} total={d.totalMembers} color="#facc15" />
          </div>
        </section>

        {/* Top lists */}
        <section className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          <TopList title="Top metros" rows={d.topMetros} />
          <TopList title="Top companies" rows={d.topCompanies} />
          <div className="rounded-lg border border-[#1f2a3d] bg-[#111726] p-5">
            <h2 className="mb-3 text-[13px] uppercase tracking-wide text-[#9bb0d4]">
              Recent event attendance
            </h2>
            <div className="text-4xl font-bold tabular-nums text-[#fb923c]">
              {d.eventAttendees30d}
            </div>
            <div className="mt-1 text-[12px] text-[#9bb0d4]">
              distinct members attended an event in the last 30 days
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

function BigStat({
  label,
  value,
  color,
  sub,
  subColor,
}: {
  label: string;
  value: number;
  color: string;
  sub?: string;
  subColor?: string;
}) {
  return (
    <div className="rounded-lg border border-[#1f2a3d] bg-[#111726] p-4">
      <div className="text-[11px] uppercase tracking-wide text-[#9bb0d4]">{label}</div>
      <div className="mt-1 text-3xl font-bold tabular-nums" style={{ color }}>
        {value.toLocaleString()}
      </div>
      {sub && (
        <div className="mt-1 text-[11px]" style={{ color: subColor ?? "#9bb0d4" }}>
          {sub}
        </div>
      )}
    </div>
  );
}

function TierMix({
  title,
  tiers,
  counts,
  colorMap,
  total,
}: {
  title: string;
  tiers: readonly string[] | string[];
  counts: Record<string, number>;
  colorMap: Record<string, string>;
  total: number;
}) {
  const sum = Object.values(counts).reduce((s, n) => s + n, 0);
  return (
    <div className="rounded-lg border border-[#1f2a3d] bg-[#111726] p-5">
      <h2 className="mb-3 text-[13px] uppercase tracking-wide text-[#9bb0d4]">{title}</h2>
      {/* Stacked bar */}
      <div className="mb-3 flex h-3 w-full overflow-hidden rounded-full bg-[#0b0f17]">
        {tiers.map((t) => {
          const n = counts[t] ?? 0;
          const w = sum ? (n / sum) * 100 : 0;
          return (
            <div
              key={t}
              style={{ width: `${w}%`, background: colorMap[t] ?? "#6a7da0" }}
              title={`${t}: ${n}`}
            />
          );
        })}
      </div>
      <ul className="space-y-1.5">
        {tiers.map((t) => {
          const n = counts[t] ?? 0;
          const pct = total ? Math.round((n / total) * 100) : 0;
          return (
            <li key={t} className="flex items-center gap-2 text-[12px]">
              <span
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ background: colorMap[t] ?? "#6a7da0" }}
              />
              <span className="flex-1 text-[#cfdaee]">{t}</span>
              <span className="tabular-nums text-white">{n}</span>
              <span className="w-10 text-right tabular-nums text-[#6a7da0]">{pct}%</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function CompTile({
  label,
  n,
  total,
  color,
}: {
  label: string;
  n: number;
  total: number;
  color: string;
}) {
  const pct = total ? Math.round((n / total) * 100) : 0;
  return (
    <div className="rounded-md border border-[#1f2a3d] bg-[#0b0f17] p-3">
      <div className="text-[11px] text-[#9bb0d4]">{label}</div>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="text-xl font-semibold tabular-nums" style={{ color }}>
          {n.toLocaleString()}
        </span>
        <span className="text-[11px] text-[#6a7da0]">{pct}%</span>
      </div>
    </div>
  );
}

function TopList({ title, rows }: { title: string; rows: { name: string; count: number }[] }) {
  return (
    <div className="rounded-lg border border-[#1f2a3d] bg-[#111726] p-5">
      <h2 className="mb-3 text-[13px] uppercase tracking-wide text-[#9bb0d4]">{title}</h2>
      {rows.length === 0 ? (
        <div className="text-[12px] text-[#6a7da0]">No data.</div>
      ) : (
        <ul className="space-y-1.5">
          {rows.map((r, i) => (
            <li key={r.name} className="flex items-center justify-between gap-2 text-[13px]">
              <span className="flex items-center gap-2 text-[#cfdaee]">
                <span className="w-5 text-right tabular-nums text-[#6a7da0]">{i + 1}.</span>
                <span>{r.name}</span>
              </span>
              <span className="font-semibold tabular-nums text-[#8ab4ff]">{r.count}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

async function EngagementExplorer({
  metric,
  scope,
  span,
  qs,
}: {
  metric: TrendMetric;
  scope: Scope;
  span: string;
  qs: (over: Record<string, string>) => string;
}) {
  const points = await getEngagementTrend(metric, scope, span);
  const pct = metric === "participating";
  const values = points.map((p) => p.value);
  const first = values[0];
  const last = values[values.length - 1];
  const delta = points.length > 1 ? Math.round((last - first) * 10) / 10 : null;
  return (
    <section id="trend" className="rounded-lg border border-[#1f2a3d] bg-[#111726] p-5">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="m-0 text-[13px] uppercase tracking-wide text-[#9bb0d4]">
          {metricLabel(metric)} over time · {scopeLabel(scope)}
        </h2>
        <span className="text-[11px] text-[#6a7da0]">weekly snapshots (Mondays), members only</span>
      </div>

      <div className="space-y-2 text-[12px]">
        <ChipRow label="Measure">
          {TREND_METRICS.map((m) => (
            <Chip key={m.key} href={qs({ metric: m.key })} active={metric === m.key} label={m.label} title={m.note} />
          ))}
        </ChipRow>
        <ChipRow label="Dimension">
          {DIMENSIONS.map((dim) => (
            <Chip key={dim} href={qs({ metric: `dim:${dim}` })} active={metric === `dim:${dim}`} label={dim[0].toUpperCase() + dim.slice(1)} />
          ))}
        </ChipRow>
        <ChipRow label="Region">
          <Chip href={qs({ region: "all" })} active={scope === "ALL"} label="All" />
          {TERRITORY_ORDER.map((t) => (
            <Chip key={t} href={qs({ region: t })} active={scope !== "ALL" && scope.length === 1 && scope[0] === t} label={TERRITORY_LABEL[t]} color={TERRITORY_COLOR[t]} />
          ))}
        </ChipRow>
        <ChipRow label="Period">
          {TREND_SPANS.map((x) => (
            <Chip key={x.key} href={qs({ span: x.key })} active={span === x.key} label={x.label} />
          ))}
        </ChipRow>
      </div>

      {points.length > 1 ? (
        <div className="mt-4">
          <div className="mb-2 flex flex-wrap items-baseline gap-3">
            <b className="text-[24px] tabular-nums text-white">{last}{pct ? "%" : ""}</b>
            {delta != null && (
              <span className="text-[12px]" style={{ color: delta >= 0 ? "#22c55e" : "#ef4444" }}>
                {delta >= 0 ? "▲" : "▼"} {Math.abs(delta)}{pct ? " pts" : ""} since {points[0].week}
              </span>
            )}
          </div>
          <LineChart
            labels={points.map((p) => p.week.slice(5))}
            series={[{ label: metricLabel(metric), color: "#a78bfa", points: values }]}
            yMax={pct || metric.startsWith("dim:") ? 100 : undefined}
            height={180}
          />
        </div>
      ) : (
        <p className="mt-4 text-[12px] text-[#6a7da0]">
          {pct
            ? "% participating fills in from the weekly snapshots taken since 8 October (one point per Monday)."
            : "Not enough weekly snapshots for this view yet."}
        </p>
      )}
      <p className="mb-0 mt-3 text-[11px] text-[#6a7da0]">
        Scores are relative (normalised to the most engaged members), so counts and % participating are the better
        guide to whether engagement is growing. Scoring changed on 8 October 2026 (virtual events weighted), so earlier
        weeks used the previous rules.
      </p>
    </section>
  );
}

function ChipRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="w-20 shrink-0 text-[11px] uppercase tracking-wide text-[#6a7da0]">{label}</span>
      {children}
    </div>
  );
}

function Chip({ href, active, label, color, title }: { href: string; active: boolean; label: string; color?: string; title?: string }) {
  return (
    <Link
      href={href}
      prefetch={false}
      scroll={false}
      title={title}
      className={
        active
          ? "flex items-center gap-1.5 rounded-md border border-[#8ab4ff] bg-[#1a2238] px-2.5 py-1 text-white"
          : "flex items-center gap-1.5 rounded-md border border-[#2d3d5c] px-2.5 py-1 text-[#9bb0d4] hover:bg-[#1a2238] hover:text-white"
      }
    >
      {color && <span className="inline-block h-2 w-2 rounded-full" style={{ background: color }} />}
      {label}
    </Link>
  );
}

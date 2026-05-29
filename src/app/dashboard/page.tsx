import Link from "next/link";
import { fetchDashboard } from "@/lib/dashboard-data";
import { QUALITY_TIER_ORDER, TIER_COLOR as QUALITY_TIER_COLOR } from "@/lib/quality-tiers";
import { TIER_COLOR as ENGAGEMENT_TIER_COLOR } from "@/components/engagement-ui";
import { TIERS } from "@/lib/engagement";

export const dynamic = "force-dynamic";
export const revalidate = 300;

const NAV = [
  { href: "/", label: "Map" },
  { href: "/dashboard", label: "Dashboard", current: true },
  { href: "/engagement", label: "Engagement" },
  { href: "/quality", label: "Quality" },
];

export default async function DashboardPage() {
  const d = await fetchDashboard();
  const maxBar = Math.max(1, ...d.monthlyJoins.map((m) => m.count));
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
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[#1f2a3d] bg-[#111726] px-6 py-4">
        <div>
          <div className="text-[12px] uppercase tracking-[0.05em] text-[#9bb0d4]">
            MEQ · Member Engagement and Quality
          </div>
          <h1 className="m-0 text-xl font-semibold">Membership Dashboard</h1>
        </div>
        <nav className="flex gap-1">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={
                n.current
                  ? "rounded-md border border-[#2d3d5c] bg-[#1a2238] px-3 py-1.5 text-[13px] text-white"
                  : "rounded-md px-3 py-1.5 text-[13px] text-[#9bb0d4] hover:bg-[#1a2238] hover:text-white"
              }
            >
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="text-[11px] text-[#6a7da0]">
          {d.syncedAt ? `synced ${new Date(d.syncedAt).toLocaleString()}` : "—"}
        </div>
      </header>

      <main className="px-6 py-5 space-y-6">
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
            <span className="text-[11px] text-[#6a7da0]">last 12 months</span>
          </div>
          <div className="flex h-32 items-end gap-2">
            {d.monthlyJoins.map((m) => {
              const h = Math.round((m.count / maxBar) * 100);
              return (
                <div key={m.month} className="flex flex-1 flex-col items-center">
                  <div
                    className="flex w-full items-end justify-center rounded-t bg-[#8ab4ff] transition-all"
                    style={{ height: `${Math.max(2, h)}%`, opacity: 0.5 + (h / 100) * 0.5 }}
                    title={`${m.month}: ${m.count}`}
                  />
                  <div className="mt-1 text-[10px] tabular-nums text-[#cfdaee]">
                    {m.count > 0 ? m.count : ""}
                  </div>
                  <div className="text-[10px] text-[#6a7da0]">
                    {m.month.slice(5)}/{m.month.slice(2, 4)}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

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

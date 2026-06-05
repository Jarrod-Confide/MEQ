import Link from "next/link";
import { Nav } from "@/components/Nav";
import { fetchTerritory } from "@/lib/territory-data";
import { fetchOutreach } from "@/lib/outreach";
import { TERRITORIES, TERRITORY_LABEL, type Territory } from "@/lib/territory";
import { GOAL_DEFS } from "@/lib/goals";
import { LineChart, StackedAreaChart, ChartLegend } from "@/components/charts";
import { TIER_COLOR } from "@/components/engagement-ui";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const SELECTABLE = TERRITORIES.filter((t) => t !== "INTL");

export default async function TerritoryPage({ searchParams }: { searchParams: Promise<{ t?: string }> }) {
  const { t } = await searchParams;
  const territory: Territory = (TERRITORIES as readonly string[]).includes(t ?? "") ? (t as Territory) : "NE";

  const [data, outreach] = await Promise.all([fetchTerritory(territory), fetchOutreach(territory)]);

  return (
    <div className="min-h-screen">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[#1f2a3d] bg-[#111726] px-6 py-4">
        <div>
          <div className="text-[12px] uppercase tracking-[0.05em] text-[#9bb0d4]">MEQ · Community Manager View</div>
          <h1 className="m-0 text-xl font-semibold">Territory · {TERRITORY_LABEL[territory]}</h1>
        </div>
        <Nav current="/territory" />
        <div className="text-[11px] text-[#6a7da0]">{data.week ? `week of ${new Date(data.week).toLocaleDateString()}` : "no data"}</div>
      </header>

      <main className="px-6 py-5 space-y-6">
        {/* Territory selector */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[12px] uppercase tracking-wide text-[#9bb0d4]">Territory</span>
          {SELECTABLE.map((tt) => (
            <Link
              key={tt}
              href={`/territory?t=${tt}`}
              className={`rounded-md px-3 py-1.5 text-[13px] ${
                tt === territory ? "bg-[#8ab4ff] text-[#0b0f17]" : "border border-[#2d3d5c] text-[#9bb0d4] hover:text-white"
              }`}
            >
              {TERRITORY_LABEL[tt]}
            </Link>
          ))}
          <Link href={`/territory?t=INTL`} className={`rounded-md px-3 py-1.5 text-[13px] ${territory === "INTL" ? "bg-[#8ab4ff] text-[#0b0f17]" : "border border-[#2d3d5c] text-[#9bb0d4] hover:text-white"}`}>
            International
          </Link>
        </div>

        {/* Summary tiles */}
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Stat label="Scored members" value={data.members} color="#cfdaee" />
          <Stat label="Avg engagement" value={data.avgEngagement} color="#8ab4ff" />
          <Stat label="Active+" value={data.champions} color="#22c55e" />
          <Stat label="Dormant" value={data.dormant} color="#6a7da0" />
          <Stat label="New (30d)" value={data.newIn30d} color="#a78bfa" />
          <Stat label="Tier moves (4w)" value={data.movedUp} color="#22c55e" sub={`▲${data.movedUp} / ▼${data.movedDown}`} />
        </section>

        {/* Goals */}
        <section className="rounded-lg border border-[#1f2a3d] bg-[#111726] p-5">
          <h2 className="mb-1 text-[13px] uppercase tracking-wide text-[#9bb0d4]">Goals (this quarter)</h2>
          <div className="mb-3 text-[11px] text-[#6a7da0]">Targets are seeded placeholders — tune per CM in <code className="text-[#9bb0d4]">src/lib/goals.ts</code>.</div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {data.goals.map((g) => {
              const def = GOAL_DEFS.find((d) => d.key === g.key)!;
              const pct = Math.max(0, Math.min(1, g.pct));
              const color = pct >= 1 ? "#22c55e" : pct >= 0.6 ? "#8ab4ff" : "#facc15";
              return (
                <div key={g.key} className="rounded-md border border-[#1f2a3d] bg-[#0b0f17] p-3">
                  <div className="text-[12px] text-[#cfdaee]">{def.label}</div>
                  <div className="mt-1 flex items-baseline gap-1.5">
                    <span className="text-2xl font-bold tabular-nums" style={{ color }}>{g.actual}</span>
                    <span className="text-[12px] text-[#6a7da0]">/ {g.target || "—"}</span>
                  </div>
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[#1a2238]">
                    <div className="h-full rounded-full" style={{ width: `${pct * 100}%`, background: color }} />
                  </div>
                  <div className="mt-1 text-[10px] text-[#6a7da0]">{def.unit}{g.target ? ` · ${Math.round(g.pct * 100)}%` : ""}</div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Charts */}
        <section className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          <ChartCard title="Members & Active+ over time">
            <LineChart
              labels={data.trend.map((p) => p.week.slice(5))}
              series={[
                { label: "Scored", color: "#8ab4ff", points: data.trend.map((p) => p.scored) },
                { label: "Active+", color: "#22c55e", points: data.trend.map((p) => p.champion + p.active) },
              ]}
            />
            <ChartLegend items={[{ label: "Scored members", color: "#8ab4ff" }, { label: "Active+ (Champion+Active)", color: "#22c55e" }]} />
          </ChartCard>

          <ChartCard title="Average engagement over time">
            <LineChart labels={data.trend.map((p) => p.week.slice(5))} series={[{ label: "Avg", color: "#a78bfa", points: data.trend.map((p) => p.avgTotal) }]} />
          </ChartCard>

          <ChartCard title="Tier mix over time">
            <StackedAreaChart
              labels={data.trend.map((p) => p.week.slice(5))}
              stacks={[
                { label: "Dormant", color: TIER_COLOR.Dormant, points: data.trend.map((p) => p.dormant) },
                { label: "Light", color: TIER_COLOR.Light, points: data.trend.map((p) => p.light) },
                { label: "Engaged", color: TIER_COLOR.Engaged, points: data.trend.map((p) => p.engaged) },
                { label: "Active", color: TIER_COLOR.Active, points: data.trend.map((p) => p.active) },
                { label: "Champion", color: TIER_COLOR.Champion, points: data.trend.map((p) => p.champion) },
              ]}
            />
            <ChartLegend items={(["Champion", "Active", "Engaged", "Light", "Dormant"] as const).map((t) => ({ label: t, color: TIER_COLOR[t] }))} />
          </ChartCard>

          <ChartCard title="High-quality members over time">
            <LineChart labels={data.trend.map((p) => p.week.slice(5))} series={[{ label: "Platinum+Gold", color: "#c4b5fd", points: data.trend.map((p) => p.highQuality) }]} />
          </ChartCard>
        </section>

        {/* Outreach summary */}
        <section className="rounded-lg border border-[#1f2a3d] bg-[#111726] p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[13px] uppercase tracking-wide text-[#9bb0d4]">Outreach worklist</h2>
            <Link href="/outreach" className="text-[12px] text-[#8ab4ff] hover:underline">Open full lists →</Link>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {outreach.segments.map((s) => (
              <Link key={s.key} href="/outreach" className="rounded-md border border-[#1f2a3d] bg-[#0b0f17] p-3 hover:border-[#2d3d5c]">
                <div className="text-2xl font-bold tabular-nums text-[#8ab4ff]">{s.rows.length}</div>
                <div className="mt-1 text-[11px] text-[#9bb0d4]">{s.label}</div>
              </Link>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

function Stat({ label, value, color, sub }: { label: string; value: number; color: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-[#1f2a3d] bg-[#111726] p-4">
      <div className="text-[11px] uppercase tracking-wide text-[#9bb0d4]">{label}</div>
      <div className="mt-1 text-2xl font-bold tabular-nums" style={{ color }}>{value.toLocaleString()}</div>
      {sub && <div className="mt-0.5 text-[11px] text-[#6a7da0]">{sub}</div>}
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-[#1f2a3d] bg-[#111726] p-5">
      <h2 className="mb-3 text-[13px] uppercase tracking-wide text-[#9bb0d4]">{title}</h2>
      {children}
    </div>
  );
}

import Link from "next/link";
import { Nav } from "@/components/Nav";
import { getRegions, type RegionSummary, type TierName } from "@/lib/region-data";
import { WINDOWS } from "@/lib/engagement-cache";
import { TERRITORY_LABEL, TERRITORY_CM, TERRITORY_COLOR } from "@/lib/territory";
import { TIER_COLOR } from "@/components/engagement-ui";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const DEFAULT_DAYS = 90;
const TIER_ORDER: TierName[] = ["Champion", "Active", "Engaged", "Light", "Dormant"];

export default async function RegionsPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  const { days: daysParam } = await searchParams;
  const days = WINDOWS.some((w) => String(w.days) === daysParam) ? Number(daysParam) : DEFAULT_DAYS;

  const data = await getRegions(days);

  // CM regions first (sorted by per-capita engagement, most-engaged on top), OTHER last.
  const cmRegions = data.summaries
    .filter((s) => s.region !== "OTHER")
    .sort((a, b) => b.avgEngagement - a.avgEngagement);
  const other = data.summaries.find((s) => s.region === "OTHER");

  const maxAvg = Math.max(1, ...data.summaries.map((s) => s.avgEngagement));

  const leader = cmRegions[0];
  const biggest = [...cmRegions].sort((a, b) => b.members - a.members)[0];

  return (
    <div className="min-h-screen">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[#1f2a3d] bg-[#111726] px-6 py-4">
        <div>
          <div className="text-[12px] uppercase tracking-[0.05em] text-[#9bb0d4]">MEQ · Community Manager View</div>
          <h1 className="m-0 text-xl font-semibold">Regions</h1>
        </div>
        <Nav current="/territory" />
        <div className="flex items-center gap-3">
          <Link href="/territory/map" className="rounded-md border border-[#2d3d5c] px-3 py-1.5 text-[12px] text-[#8ab4ff] hover:bg-[#1a2238]">
            🗺 Regions map
          </Link>
        </div>
      </header>

      <main className="px-6 py-5 space-y-6">
        {/* Window picker + headline */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[12px] uppercase tracking-wide text-[#9bb0d4]">Engagement window</span>
            {WINDOWS.map((w) => (
              <Link
                key={w.days}
                href={`/territory?days=${w.days}`}
                className={`rounded-md px-3 py-1.5 text-[13px] ${
                  w.days === days ? "bg-[#8ab4ff] text-[#0b0f17]" : "border border-[#2d3d5c] text-[#9bb0d4] hover:text-white"
                }`}
              >
                {w.label}
              </Link>
            ))}
          </div>
          {leader && biggest && (
            <div className="text-[12px] text-[#9bb0d4]">
              <span className="text-[#cfdaee] font-medium">{TERRITORY_LABEL[biggest.region]}</span> is biggest ({biggest.members.toLocaleString()} members);{" "}
              <span className="text-[#cfdaee] font-medium">{TERRITORY_LABEL[leader.region]}</span> is most engaged (avg {leader.avgEngagement.toFixed(1)}).
            </div>
          )}
        </div>

        {/* Comparison bars — avg engagement per capita */}
        <section className="rounded-lg border border-[#1f2a3d] bg-[#111726] p-5">
          <h2 className="mb-4 text-[13px] uppercase tracking-wide text-[#9bb0d4]">Average engagement per member (by region)</h2>
          <div className="space-y-3">
            {[...cmRegions, ...(other ? [other] : [])].map((s) => (
              <div key={s.region} className="flex items-center gap-3">
                <div className="w-28 shrink-0 text-[13px] text-[#cfdaee]">{TERRITORY_LABEL[s.region]}</div>
                <div className="flex-1">
                  <div className="h-6 overflow-hidden rounded bg-[#0b0f17]">
                    <div
                      className="flex h-full items-center justify-end rounded pr-2 text-[11px] font-semibold text-[#0b0f17]"
                      style={{ width: `${Math.max(6, (s.avgEngagement / maxAvg) * 100)}%`, background: TERRITORY_COLOR[s.region] }}
                    >
                      {s.avgEngagement.toFixed(1)}
                    </div>
                  </div>
                </div>
                <div className="w-40 shrink-0 text-right text-[11px] text-[#6a7da0]">
                  {s.members.toLocaleString()} members · {s.engagedRate}% engaged
                </div>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[11px] text-[#6a7da0]">
            Per-capita = mean engagement across every member in the region (dormant counted as 0), so a small, active region can out-rank a large, quiet one. Click a region to see its most-engaged members.
          </p>
        </section>

        {/* Region cards */}
        <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {cmRegions.map((s) => (
            <RegionCard key={s.region} s={s} />
          ))}
        </section>

        {other && other.members > 0 && (
          <section>
            <RegionCard s={other} muted />
          </section>
        )}
      </main>
    </div>
  );
}

function RegionCard({ s, muted }: { s: RegionSummary; muted?: boolean }) {
  const cm = TERRITORY_CM[s.region];
  const color = TERRITORY_COLOR[s.region];
  return (
    <Link
      href={`/territory/${s.region}`}
      className={`block rounded-lg border p-5 transition hover:border-[#2d3d5c] ${
        muted ? "border-[#1f2a3d] bg-[#0d121e]" : "border-[#1f2a3d] bg-[#111726]"
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <span className="inline-block h-3 w-3 rounded-full" style={{ background: color }} />
          <div>
            <div className="text-[15px] font-semibold text-[#e8eefc]">{TERRITORY_LABEL[s.region]}</div>
            {cm && <div className="text-[11px] text-[#9bb0d4]">CM · {cm}</div>}
          </div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold tabular-nums" style={{ color }}>{s.avgEngagement.toFixed(1)}</div>
          <div className="text-[10px] uppercase tracking-wide text-[#6a7da0]">avg engagement</div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-4 gap-2 text-center">
        <Mini label="Members" value={s.members.toLocaleString()} />
        <Mini label="Engaged" value={`${s.engagedRate}%`} />
        <Mini label="Avg quality" value={s.avgQuality != null ? String(s.avgQuality) : "—"} />
        <Mini label="High-quality" value={s.highQuality.toLocaleString()} />
      </div>

      {/* Tier mix bar */}
      <div className="mt-4">
        <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-[#0b0f17]">
          {TIER_ORDER.map((t) => {
            const n = s.tierCounts[t];
            if (!n) return null;
            return <div key={t} style={{ width: `${(n / Math.max(1, s.members)) * 100}%`, background: TIER_COLOR[t] }} title={`${t}: ${n}`} />;
          })}
        </div>
        <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-[#6a7da0]">
          {TIER_ORDER.map((t) => (
            <span key={t} className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-full" style={{ background: TIER_COLOR[t] }} />
              {t} {s.tierCounts[t]}
            </span>
          ))}
        </div>
      </div>

      <div className="mt-4 text-[12px] text-[#8ab4ff]">See most-engaged members →</div>
    </Link>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-[#1f2a3d] bg-[#0b0f17] p-2">
      <div className="text-[15px] font-bold tabular-nums text-[#cfdaee]">{value}</div>
      <div className="text-[10px] uppercase tracking-wide text-[#6a7da0]">{label}</div>
    </div>
  );
}

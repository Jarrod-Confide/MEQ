import Link from "next/link";
import { notFound } from "next/navigation";
import { Nav } from "@/components/Nav";
import { getRegions, getRegionCityTrends } from "@/lib/region-data";
import { RegionMemberTable } from "@/components/RegionMemberTable";
import { RegionTrendMap } from "@/components/RegionTrendMap";
import { WINDOWS } from "@/lib/engagement-cache";
import { TERRITORIES, TERRITORY_LABEL, TERRITORY_CM, TERRITORY_COLOR, type Territory } from "@/lib/territory";
import { TIER_COLOR } from "@/components/engagement-ui";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const DEFAULT_DAYS = 90;

export default async function RegionDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ region: string }>;
  searchParams: Promise<{ days?: string }>;
}) {
  const { region: raw } = await params;
  const region = raw.toUpperCase() as Territory;
  if (!(TERRITORIES as readonly string[]).includes(region)) notFound();

  const { days: daysParam } = await searchParams;
  const days = WINDOWS.some((w) => String(w.days) === daysParam) ? Number(daysParam) : DEFAULT_DAYS;

  const [data, cityTrends] = await Promise.all([getRegions(days), getRegionCityTrends(region)]);
  const summary = data.summaries.find((s) => s.region === region)!;
  const members = data.membersByRegion[region];
  const cm = TERRITORY_CM[region];
  const color = TERRITORY_COLOR[region];

  return (
    <div className="min-h-screen">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[#1f2a3d] bg-[#111726] px-6 py-4">
        <div>
          <div className="text-[12px] uppercase tracking-[0.05em] text-[#9bb0d4]">MEQ · Community Manager View</div>
          <h1 className="m-0 flex items-center gap-2 text-xl font-semibold">
            <span className="inline-block h-3 w-3 rounded-full" style={{ background: color }} />
            {TERRITORY_LABEL[region]}
            {cm && <span className="text-[13px] font-normal text-[#9bb0d4]">· CM {cm}</span>}
          </h1>
        </div>
        <Nav current="/territory" />
        <Link href="/territory" className="text-[12px] text-[#8ab4ff] hover:underline">← All regions</Link>
      </header>

      <main className="px-6 py-5 space-y-6">
        {/* Window picker */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[12px] uppercase tracking-wide text-[#9bb0d4]">Engagement window</span>
          {WINDOWS.map((w) => (
            <Link
              key={w.days}
              href={`/territory/${region}?days=${w.days}`}
              className={`rounded-md px-3 py-1.5 text-[13px] ${
                w.days === days ? "bg-[#8ab4ff] text-[#0b0f17]" : "border border-[#2d3d5c] text-[#9bb0d4] hover:text-white"
              }`}
            >
              {w.label}
            </Link>
          ))}
        </div>

        {/* Summary tiles */}
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Stat label="Members" value={summary.members.toLocaleString()} color="#cfdaee" />
          <Stat label="Avg engagement" value={summary.avgEngagement.toFixed(1)} color={color} />
          <Stat label="% engaged" value={`${summary.engagedRate}%`} color="#22c55e" />
          <Stat label="Champions+Active" value={summary.champions.toLocaleString()} color={TIER_COLOR.Active} />
          <Stat label="Avg quality" value={summary.avgQuality != null ? String(summary.avgQuality) : "—"} color="#c4b5fd" />
          <Stat label="High-quality" value={summary.highQuality.toLocaleString()} color="#facc15" />
        </section>

        {/* Hotspot map — 4-week engagement trend by city */}
        <section className="rounded-lg border border-[#1f2a3d] bg-[#111726]">
          <div className="flex items-center justify-between border-b border-[#1f2a3d] px-5 py-3">
            <h2 className="text-[13px] uppercase tracking-wide text-[#9bb0d4]">Hotspots — engagement trend by city</h2>
            <span className="text-[11px] text-[#6a7da0]">latest snapshot week vs ~4 weeks prior</span>
          </div>
          <div className="h-[380px] overflow-hidden rounded-b-lg bg-[#0b0f17]">
            <RegionTrendMap cities={cityTrends} />
          </div>
        </section>

        {/* Member ranking */}
        <section className="rounded-lg border border-[#1f2a3d] bg-[#111726] p-0">
          <div className="flex items-center justify-between border-b border-[#1f2a3d] px-5 py-3">
            <h2 className="text-[13px] uppercase tracking-wide text-[#9bb0d4]">Most-engaged members</h2>
            <span className="text-[11px] text-[#6a7da0]">{members.length.toLocaleString()} members · click a column to sort</span>
          </div>
          <RegionMemberTable members={members} />
        </section>
      </main>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded-lg border border-[#1f2a3d] bg-[#111726] p-4">
      <div className="text-[11px] uppercase tracking-wide text-[#9bb0d4]">{label}</div>
      <div className="mt-1 text-2xl font-bold tabular-nums" style={{ color }}>{value}</div>
    </div>
  );
}

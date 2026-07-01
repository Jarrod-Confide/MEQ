import Link from "next/link";
import { notFound } from "next/navigation";
import { Nav } from "@/components/Nav";
import { getRegions } from "@/lib/region-data";
import { WINDOWS } from "@/lib/engagement-cache";
import { TERRITORIES, TERRITORY_LABEL, TERRITORY_CM, TERRITORY_COLOR, type Territory } from "@/lib/territory";
import { TierBadge, TIER_COLOR } from "@/components/engagement-ui";
import type { Tier } from "@/lib/engagement";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const DEFAULT_DAYS = 90;

function qualityColor(tier: string | null): string {
  switch (tier) {
    case "Platinum": return "#e5e7eb";
    case "Gold": return "#facc15";
    case "Silver": return "#cbd5e1";
    case "Bronze": return "#d6a06a";
    default: return "#6a7da0";
  }
}

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

  const data = await getRegions(days);
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
          <Stat label="Avg engagement" value={String(summary.avgEngagement)} color={color} />
          <Stat label="% engaged" value={`${summary.engagedRate}%`} color="#22c55e" />
          <Stat label="Champions+Active" value={summary.champions.toLocaleString()} color={TIER_COLOR.Active} />
          <Stat label="Avg quality" value={summary.avgQuality != null ? String(summary.avgQuality) : "—"} color="#c4b5fd" />
          <Stat label="High-quality" value={summary.highQuality.toLocaleString()} color="#facc15" />
        </section>

        {/* Member ranking */}
        <section className="rounded-lg border border-[#1f2a3d] bg-[#111726] p-0">
          <div className="flex items-center justify-between border-b border-[#1f2a3d] px-5 py-3">
            <h2 className="text-[13px] uppercase tracking-wide text-[#9bb0d4]">Most-engaged members</h2>
            <span className="text-[11px] text-[#6a7da0]">{members.length.toLocaleString()} members · ranked by engagement</span>
          </div>
          {members.length === 0 ? (
            <div className="px-5 py-8 text-center text-[13px] text-[#6a7da0]">No members in this region.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wide text-[#6a7da0]">
                    <th className="px-5 py-2 font-medium">#</th>
                    <th className="px-3 py-2 font-medium">Member</th>
                    <th className="px-3 py-2 font-medium">Engagement</th>
                    <th className="px-3 py-2 font-medium">Quality</th>
                    <th className="px-3 py-2 font-medium">Company</th>
                    <th className="px-3 py-2 font-medium">City</th>
                    <th className="px-3 py-2 font-medium">Contact</th>
                  </tr>
                </thead>
                <tbody>
                  {members.map((m, i) => (
                    <tr key={m.key} className="border-t border-[#141c2b] hover:bg-[#0d121e]">
                      <td className="px-5 py-2 tabular-nums text-[#6a7da0]">{i + 1}</td>
                      <td className="px-3 py-2">
                        <Link href={`/engagement/${encodeURIComponent(m.key)}`} className="text-[#cfdaee] hover:text-white hover:underline">
                          {m.name}
                        </Link>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <span className="tabular-nums font-semibold" style={{ color: TIER_COLOR[(m.tier as Tier)] ?? "#cfdaee" }}>{m.total}</span>
                          <TierBadge tier={m.tier as Tier} />
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        {m.qualityScore != null ? (
                          <span className="tabular-nums" style={{ color: qualityColor(m.qualityTier) }}>
                            {m.qualityScore}
                            {m.qualityTier ? <span className="ml-1 text-[11px] text-[#6a7da0]">{m.qualityTier}</span> : null}
                          </span>
                        ) : (
                          <span className="text-[#6a7da0]">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-[#9bb0d4]">{m.company ?? "—"}</td>
                      <td className="px-3 py-2 text-[#9bb0d4]">{m.city ?? "—"}</td>
                      <td className="px-3 py-2">
                        {m.email ? (
                          <a href={`mailto:${m.email}`} className="text-[#8ab4ff] hover:underline">{m.email}</a>
                        ) : (
                          <span className="text-[#6a7da0]">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
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

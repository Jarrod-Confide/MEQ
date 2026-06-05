import Link from "next/link";
import { Nav } from "@/components/Nav";
import { fetchMemberMap } from "@/lib/members";
import { TerritoryMap, type TerritoryPoint } from "@/components/TerritoryMap";
import { territoryFromCoords, TERRITORY_LABEL, TERRITORY_ORDER } from "@/lib/territory";

export const revalidate = 300;

export default async function TerritoryMapPage() {
  const data = await fetchMemberMap();
  const points: TerritoryPoint[] = data.points.map((p) => ({
    name: p.name,
    lat: p.lat,
    lng: p.lng,
    members: p.members,
    territory: territoryFromCoords(p.lat, p.lng, p.country),
  }));

  // Member totals per territory (for the header chips).
  const totals = new Map<string, number>();
  for (const p of points) totals.set(p.territory, (totals.get(p.territory) ?? 0) + p.members);

  return (
    <div className="flex h-screen flex-col">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[#1f2a3d] bg-[#111726] px-6 py-4">
        <div>
          <div className="text-[12px] uppercase tracking-[0.05em] text-[#9bb0d4]">MEQ · Community Manager View</div>
          <h1 className="m-0 text-xl font-semibold">Territory Map</h1>
        </div>
        <Nav current="/territory" />
        <Link href="/territory" className="text-[12px] text-[#8ab4ff] hover:underline">← Back to territory dashboard</Link>
      </header>

      <div className="flex flex-wrap gap-4 border-b border-[#1f2a3d] bg-[#0b0f17] px-6 py-2 text-[12px]">
        {TERRITORY_ORDER.map((t) => (
          <span key={t} className="text-[#9bb0d4]">
            <b className="text-[#cfdaee]">{TERRITORY_LABEL[t]}:</b> {(totals.get(t) ?? 0).toLocaleString()}
          </span>
        ))}
        <span className="text-[#6a7da0]">Cities mapped by closest major city; dividing lines are configurable.</span>
      </div>

      <main className="flex-1 overflow-hidden">
        <TerritoryMap points={points} />
      </main>
    </div>
  );
}

import { fetchMemberMap } from "@/lib/members";
import { MemberBubbleMap } from "@/components/MemberBubbleMap";
import { CityList } from "@/components/CityList";
import { Nav } from "@/components/Nav";

export const revalidate = 300; // refresh every 5 min

export default async function MemberMapPage() {
  const data = await fetchMemberMap();
  const usMembers = data.points
    .filter((p) => p.country === "US")
    .reduce((s, p) => s + p.members, 0);
  const usShare = data.totalMembers
    ? Math.round((usMembers / data.totalMembers) * 100)
    : 0;

  return (
    <div className="flex h-screen flex-col">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[#1f2a3d] bg-[#111726] px-6 py-4">
        <div>
          <div className="text-[12px] uppercase tracking-[0.05em] text-[#9bb0d4]">
            MEQ · Member Engagement and Quality
          </div>
          <h1 className="m-0 text-xl font-semibold">Global Member Map</h1>
        </div>
        <Nav current="/" />
        <div className="flex flex-wrap gap-6 text-[13px]">
          <span>
            <b className="mr-1 text-base text-[#8ab4ff]">
              {data.totalMembers.toLocaleString()}
            </b>
            members
          </span>
          <span>
            <b className="mr-1 text-base text-[#8ab4ff]">{data.totalCities}</b>
            cities
          </span>
          <span>
            <b className="mr-1 text-base text-[#8ab4ff]">
              {data.totalCountries}
            </b>
            countries
          </span>
          <span>
            <b className="mr-1 text-base text-[#8ab4ff]">{usShare}%</b>
            US
          </span>
        </div>
      </header>
      <main className="grid flex-1 grid-cols-[1fr_320px] overflow-hidden">
        <MemberBubbleMap points={data.points} />
        <aside className="overflow-y-auto border-l border-[#1f2a3d] bg-[#111726] p-5">
          <h2 className="m-0 mb-1 text-[13px] uppercase tracking-[0.05em] text-[#9bb0d4]">
            Top Cities
          </h2>
          <div className="mb-4 text-[12px] text-[#6a7da0]">
            Members by closest major city · switch the map view to color by
            quality, engagement, or priority outreach.
          </div>
          <CityList points={data.points} />
          {data.unmatched.length > 0 && (
            <div className="mt-5 rounded-md border border-dashed border-[#2d3d5c] bg-[#0b0f17] p-3 text-[11px] leading-relaxed text-[#6a7da0]">
              <b className="text-[#fb923c]">
                {data.unmatched.reduce((s, u) => s + u.members, 0)} members
              </b>{" "}
              from {data.unmatched.length} unmatched{" "}
              {data.unmatched.length === 1 ? "city" : "cities"} —{" "}
              <a
                href="/admin/unmatched"
                className="text-[#8ab4ff] underline-offset-2 hover:underline"
              >
                review
              </a>
            </div>
          )}
        </aside>
      </main>
    </div>
  );
}

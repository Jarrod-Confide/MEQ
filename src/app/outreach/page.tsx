import { fetchOutreach } from "@/lib/outreach";
import { OutreachLists } from "@/components/OutreachLists";
import { Nav } from "@/components/Nav";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export default async function OutreachPage() {
  const data = await fetchOutreach("ALL");
  const totalContacts = data.segments.reduce((s, seg) => s + seg.rows.length, 0);

  return (
    <div className="min-h-screen">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[#1f2a3d] bg-[#111726] px-6 py-4">
        <div>
          <div className="text-[12px] uppercase tracking-[0.05em] text-[#9bb0d4]">
            MEQ · Member Engagement and Quality
          </div>
          <h1 className="m-0 text-xl font-semibold">Outreach Lists</h1>
        </div>
        <Nav current="/outreach" />
        <div className="text-[11px] text-[#6a7da0]">
          {data.week ? `as of week of ${new Date(data.week).toLocaleDateString()}` : "no snapshot yet"}
        </div>
      </header>

      <main className="px-6 py-5">
        <p className="mb-4 max-w-prose text-[12px] leading-relaxed text-[#6a7da0]">
          Ranked, territory-scoped worklists for community managers — built from
          the latest weekly snapshot and 4-week trend. Filter by territory, pick
          a segment, and export to CSV to work the list. Each row links to the
          member&rsquo;s detail and surfaces how to reach them.
          <span className="ml-1 text-[#9bb0d4]">{totalContacts.toLocaleString()} total opportunities across {data.segments.length} segments.</span>
        </p>
        <OutreachLists segments={data.segments} />
      </main>
    </div>
  );
}

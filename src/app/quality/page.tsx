import Link from "next/link";
import { fetchQuality } from "@/lib/quality-data";
import { QualityTable } from "@/components/QualityTable";

export const dynamic = "force-dynamic";

export default async function QualityPage() {
  const data = await fetchQuality();

  const stat = (label: string, value: number, color = "#8ab4ff") => (
    <span className="flex items-center gap-1.5 text-[13px]">
      <b className="text-base tabular-nums" style={{ color }}>
        {value.toLocaleString()}
      </b>
      <span className="text-[#9bb0d4]">{label}</span>
    </span>
  );

  return (
    <div className="min-h-screen">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[#1f2a3d] bg-[#111726] px-6 py-4">
        <div>
          <div className="text-[12px] uppercase tracking-[0.05em] text-[#9bb0d4]">
            MEQ · Member Engagement and Quality
          </div>
          <h1 className="m-0 text-xl font-semibold">Member Quality</h1>
        </div>
        <nav className="flex gap-1">
          <Link href="/" className="rounded-md px-3 py-1.5 text-[13px] text-[#9bb0d4] hover:bg-[#1a2238] hover:text-white">
            Map
          </Link>
          <Link href="/engagement" className="rounded-md px-3 py-1.5 text-[13px] text-[#9bb0d4] hover:bg-[#1a2238] hover:text-white">
            Engagement
          </Link>
          <Link href="/quality" className="rounded-md border border-[#2d3d5c] bg-[#1a2238] px-3 py-1.5 text-[13px] text-white">
            Quality
          </Link>
        </nav>
        <div className="text-[11px] text-[#6a7da0]">
          {data.syncedAt ? `synced ${new Date(data.syncedAt).toLocaleString()}` : "not yet synced"}
        </div>
      </header>

      <main className="px-6 py-5">
        <div className="mb-5 flex flex-wrap gap-5">
          {stat("members", data.total, "#cfdaee")}
          {stat("high quality", data.stats.highQuality, "#22c55e")}
          {stat("Fortune 2000", data.stats.fortune2000, "#a78bfa")}
          {stat("report to CEO", data.stats.reportsToCeo)}
          {stat("C-Level", data.stats.cLevel)}
          {stat("self-employed", data.stats.selfEmployed, "#facc15")}
        </div>

        <p className="mb-4 max-w-prose text-[12px] leading-relaxed text-[#6a7da0]">
          Employer attributes from HubSpot (employment, reporting line, seniority,
          team size, company size). <b className="text-[#9bb0d4]">High quality (v1)</b>{" "}
          = works for a Fortune 2000 company — expandable with seniority/team-size
          thresholds. Many HubSpot fields are sparsely filled, so blanks reflect
          missing CRM data, not the member.
        </p>

        <QualityTable rows={data.rows} />
      </main>
    </div>
  );
}

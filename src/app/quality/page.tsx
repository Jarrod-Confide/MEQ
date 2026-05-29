import Link from "next/link";
import { fetchQuality } from "@/lib/quality-data";
import { QUALITY_TIER_ORDER, TIER_COLOR } from "@/lib/quality-tiers";
import { QualityTable } from "@/components/QualityTable";
import { getEngagement } from "@/lib/engagement-cache";

export const dynamic = "force-dynamic";

export default async function QualityPage() {
  const [data, engagement] = await Promise.all([fetchQuality(), getEngagement(90)]);

  // Decorate each quality row with the matching engagement score/tier.
  // Engagement member keys are `c:<eventflow_contact_id>` for matched members.
  const engagementByEf = new Map<string, { score: number; tier: string }>();
  for (const m of engagement.members) {
    if (m.key.startsWith("c:")) {
      engagementByEf.set(m.key.slice(2), { score: m.total, tier: m.tier });
    }
  }
  const enriched = data.rows.map((r) => {
    const e = r.eventflowContactId ? engagementByEf.get(r.eventflowContactId) : null;
    return {
      ...r,
      engagementScore: e?.score ?? null,
      engagementTier: e?.tier ?? null,
    };
  });

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
          <Link href="/dashboard" className="rounded-md px-3 py-1.5 text-[13px] text-[#9bb0d4] hover:bg-[#1a2238] hover:text-white">
            Dashboard
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
        <div className="mb-3 flex flex-wrap gap-5">
          {stat("members", data.total, "#cfdaee")}
          {QUALITY_TIER_ORDER.map((t) => (
            <span key={t} className="flex items-center gap-1.5 text-[13px]">
              <span
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ background: TIER_COLOR[t] }}
              />
              <b className="tabular-nums text-white">{data.tierCounts[t] ?? 0}</b>
              <span className="text-[#9bb0d4]">{t}</span>
            </span>
          ))}
        </div>
        <div className="mb-5 flex flex-wrap gap-5">
          {stat("Fortune 2000", data.stats.fortune2000, "#a78bfa")}
          {stat("report to CEO", data.stats.reportsToCeo)}
          {stat("C-Level", data.stats.cLevel)}
          {stat("self-employed", data.stats.selfEmployed, "#facc15")}
        </div>

        <p className="mb-4 max-w-prose text-[12px] leading-relaxed text-[#6a7da0]">
          <b className="text-[#9bb0d4]">Quality score (0–100, v1)</b> = 0.35 company
          prominence (Fortune 2000 + size) + 0.30 authority (seniority + reporting
          line) + 0.20 team size + 0.15 employment. Tiers: Platinum ≥80, Gold ≥60,
          Silver ≥40, Bronze ≥20. Sourced from HubSpot; sparse fields (blanks) lower
          a score rather than the member being low-value — a data-completeness, not
          quality, signal.
        </p>

        <QualityTable rows={enriched} />
      </main>
    </div>
  );
}

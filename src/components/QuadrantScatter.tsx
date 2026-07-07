"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { QuadrantPoint } from "@/lib/quadrant-data";
import { TERRITORY_LABEL, TERRITORY_ORDER, type Territory } from "@/lib/territory";

// Plot geometry
const W = 760;
const H = 470;
const PAD_L = 46;
const PAD_R = 16;
const PAD_T = 16;
const PAD_B = 40;
const PW = W - PAD_L - PAD_R;
const PH = H - PAD_T - PAD_B;

const QUAD = {
  champions: { label: "Champions", color: "#22c55e", hint: "high quality · high engagement" },
  priority: { label: "Priority outreach", color: "#fb923c", hint: "high quality · low engagement" },
  engaged: { label: "Engaged", color: "#60a5fa", hint: "lower quality · high engagement" },
  low: { label: "Low / dormant", color: "#6a7da0", hint: "low quality · low engagement" },
} as const;
type QuadKey = keyof typeof QUAD;

// Stable pseudo-jitter per member so overlapping dots (e.g. the 0,0 cloud) spread.
function jitter(id: string, salt: number): number {
  let h = salt;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return ((h % 1000) / 1000 - 0.5) * 3.2; // ±1.6 units
}

function quadOf(p: QuadrantPoint, eCut: number, qCut: number): QuadKey {
  const hiE = p.engagement >= eCut;
  const hiQ = p.quality >= qCut;
  if (hiQ && hiE) return "champions";
  if (hiQ && !hiE) return "priority";
  if (!hiQ && hiE) return "engaged";
  return "low";
}

type Preset = "default" | "active" | "spotlight";

function csvEscape(v: string | number | null): string {
  if (v == null) return "";
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function downloadCsv(filename: string, rows: QuadrantPoint[], quad: QuadKey) {
  const lines = ["name,company,email,territory,quality,engagement,quadrant"];
  for (const r of rows) {
    lines.push(
      [r.name, r.company, r.email, TERRITORY_LABEL[r.territory], r.quality, r.engagement.toFixed(1), QUAD[quad].label]
        .map(csvEscape)
        .join(",")
    );
  }
  const blob = new Blob([lines.join("\n")], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

export function QuadrantScatter({ points }: { points: QuadrantPoint[] }) {
  const router = useRouter();
  const [qCut, setQCut] = useState(60); // quality cutoff (Gold)
  const [eCut, setECut] = useState(20); // engagement cutoff (scores are p95-normalized, skew low)
  const [excludeDormant, setExcludeDormant] = useState(false);
  const [territory, setTerritory] = useState<Territory | "ALL">("ALL");
  const [spotlight, setSpotlight] = useState(false);
  const [selectedQuad, setSelectedQuad] = useState<QuadKey>("priority");

  const x = (e: number) => PAD_L + (e / 100) * PW;
  const y = (q: number) => PAD_T + PH - (q / 100) * PH;

  const visible = useMemo(
    () =>
      points.filter(
        (p) =>
          (territory === "ALL" || p.territory === territory) &&
          (!excludeDormant || p.engagement > 0)
      ),
    [points, territory, excludeDormant]
  );

  const counts = useMemo(() => {
    const c: Record<QuadKey, number> = { champions: 0, priority: 0, engaged: 0, low: 0 };
    for (const p of visible) c[quadOf(p, eCut, qCut)]++;
    return c;
  }, [visible, eCut, qCut]);
  const shown = visible.length;

  // Members in the selected quadrant, ranked for its natural worklist order:
  // priority/low → quality first (who matters most), champions/engaged → engagement first.
  const quadMembers = useMemo(() => {
    const list = visible.filter((p) => quadOf(p, eCut, qCut) === selectedQuad);
    const byQuality = selectedQuad === "priority" || selectedQuad === "low";
    list.sort((a, b) =>
      byQuality ? b.quality - a.quality || b.engagement - a.engagement : b.engagement - a.engagement || b.quality - a.quality
    );
    return list;
  }, [visible, eCut, qCut, selectedQuad]);

  const applyPreset = (p: Preset) => {
    if (p === "default") { setQCut(60); setECut(20); setExcludeDormant(false); setSpotlight(false); }
    if (p === "active") { setExcludeDormant(true); setSpotlight(false); }
    if (p === "spotlight") { setSpotlight(true); setSelectedQuad("priority"); }
  };

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_560px]">
      {/* Chart */}
      <div className="rounded-lg border border-[#1f2a3d] bg-[#0b0f17] p-3">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: 520 }}>
          {/* quadrant tint (selected quadrant glows a little brighter) */}
          <rect x={x(eCut)} y={PAD_T} width={x(100) - x(eCut)} height={y(qCut) - PAD_T} fill={QUAD.champions.color} opacity={selectedQuad === "champions" ? 0.12 : 0.05} className="cursor-pointer" onClick={() => setSelectedQuad("champions")} />
          <rect x={PAD_L} y={PAD_T} width={x(eCut) - PAD_L} height={y(qCut) - PAD_T} fill={QUAD.priority.color} opacity={selectedQuad === "priority" ? 0.13 : 0.06} className="cursor-pointer" onClick={() => setSelectedQuad("priority")} />
          <rect x={x(eCut)} y={y(qCut)} width={x(100) - x(eCut)} height={y(0) - y(qCut)} fill={QUAD.engaged.color} opacity={selectedQuad === "engaged" ? 0.12 : 0.05} className="cursor-pointer" onClick={() => setSelectedQuad("engaged")} />
          <rect x={PAD_L} y={y(qCut)} width={x(eCut) - PAD_L} height={y(0) - y(qCut)} fill={QUAD.low.color} opacity={selectedQuad === "low" ? 0.1 : 0} className="cursor-pointer" onClick={() => setSelectedQuad("low")} />
          {/* axes ticks */}
          {[0, 25, 50, 75, 100].map((t) => (
            <g key={`gx${t}`}>
              <line x1={x(t)} y1={PAD_T} x2={x(t)} y2={PAD_T + PH} stroke="#141c2b" strokeWidth={1} />
              <text x={x(t)} y={H - 24} fontSize="9" fill="#6a7da0" textAnchor="middle">{t}</text>
            </g>
          ))}
          {[0, 25, 50, 75, 100].map((t) => (
            <g key={`gy${t}`}>
              <line x1={PAD_L} y1={y(t)} x2={PAD_L + PW} y2={y(t)} stroke="#141c2b" strokeWidth={1} />
              <text x={PAD_L - 6} y={y(t) + 3} fontSize="9" fill="#6a7da0" textAnchor="end">{t}</text>
            </g>
          ))}
          {/* threshold lines */}
          <line x1={x(eCut)} y1={PAD_T} x2={x(eCut)} y2={PAD_T + PH} stroke="#e2e8f0" strokeWidth={1.5} strokeDasharray="5 4" />
          <line x1={PAD_L} y1={y(qCut)} x2={PAD_L + PW} y2={y(qCut)} stroke="#e2e8f0" strokeWidth={1.5} strokeDasharray="5 4" />
          {/* dots */}
          {visible.map((p) => {
            const qk = quadOf(p, eCut, qCut);
            const dim = spotlight && qk !== "priority";
            return (
              <circle
                key={p.memberId}
                cx={x(p.engagement) + jitter(p.memberId, 1)}
                cy={y(p.quality) + jitter(p.memberId, 7)}
                r={3}
                fill={QUAD[qk].color}
                fillOpacity={dim ? 0.08 : 0.55}
                stroke="none"
                style={{ cursor: p.eventflowContactId ? "pointer" : "default" }}
                onClick={() =>
                  p.eventflowContactId &&
                  router.push(`/engagement/${encodeURIComponent("c:" + p.eventflowContactId)}`)
                }
              >
                <title>{`${p.name ?? "—"}${p.company ? " · " + p.company : ""}\nengagement ${p.engagement.toFixed(1)} · quality ${p.quality}`}</title>
              </circle>
            );
          })}
          {/* axis titles */}
          <text x={PAD_L + PW / 2} y={H - 6} fontSize="11" fill="#9bb0d4" textAnchor="middle">Engagement →</text>
          <text x={14} y={PAD_T + PH / 2} fontSize="11" fill="#9bb0d4" textAnchor="middle" transform={`rotate(-90 14 ${PAD_T + PH / 2})`}>Quality ↑</text>
        </svg>
        <div className="px-2 pb-1 text-[11px] text-[#6a7da0]">{shown.toLocaleString()} members shown · click a dot for the profile · click a quadrant to list it →</div>
      </div>

      {/* Right column: controls + quadrant member list */}
      <div className="space-y-4">
        <div className="rounded-lg border border-[#1f2a3d] bg-[#111726] p-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="grow">
              <div className="mb-1 text-[11px] uppercase tracking-wide text-[#9bb0d4]">Quadrant cut-points</div>
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-[12px] text-[#cfdaee]">
                  Quality ≥ <b className="tabular-nums text-white">{qCut}</b>
                  <input type="range" min={0} max={100} value={qCut} onChange={(e) => setQCut(+e.target.value)} className="mt-1 w-full accent-[#8ab4ff]" />
                </label>
                <label className="block text-[12px] text-[#cfdaee]">
                  Engagement ≥ <b className="tabular-nums text-white">{eCut}</b>
                  <input type="range" min={0} max={100} value={eCut} onChange={(e) => setECut(+e.target.value)} className="mt-1 w-full accent-[#8ab4ff]" />
                </label>
              </div>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-[12px]">
            <label className="flex items-center gap-2 text-[#cfdaee]">
              <input type="checkbox" checked={excludeDormant} onChange={(e) => setExcludeDormant(e.target.checked)} className="accent-[#8ab4ff]" />
              Exclude dormant
            </label>
            <label className="flex items-center gap-2 text-[#cfdaee]">
              <input type="checkbox" checked={spotlight} onChange={(e) => setSpotlight(e.target.checked)} className="accent-[#8ab4ff]" />
              Spotlight priority
            </label>
            <span>
              <span className="text-[#9bb0d4]">Region </span>
              <select value={territory} onChange={(e) => setTerritory(e.target.value as Territory | "ALL")} className="rounded border border-[#2d3d5c] bg-[#0b0f17] px-2 py-1 text-[12px] text-white">
                <option value="ALL">All</option>
                {TERRITORY_ORDER.map((t) => (<option key={t} value={t}>{TERRITORY_LABEL[t]}</option>))}
              </select>
            </span>
            {(["default", "active", "spotlight"] as Preset[]).map((p) => (
              <button key={p} onClick={() => applyPreset(p)} className="rounded-md border border-[#2d3d5c] px-2.5 py-1 text-[12px] text-[#9bb0d4] hover:text-white">
                {p === "default" ? "Default" : p === "active" ? "Active only" : "Spotlight"}
              </button>
            ))}
          </div>
        </div>

        {/* Quadrant selector (live counts) */}
        <div className="grid grid-cols-4 gap-2">
          {(Object.keys(QUAD) as QuadKey[]).map((k) => (
            <button
              key={k}
              onClick={() => setSelectedQuad(k)}
              className={`rounded-md border p-2.5 text-left transition ${
                selectedQuad === k ? "border-[#2d3d5c] bg-[#1a2238]" : "border-[#1f2a3d] bg-[#0b0f17] hover:border-[#2d3d5c]"
              }`}
            >
              <div className="flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: QUAD[k].color }} />
                <span className="truncate text-[10px] text-[#9bb0d4]">{QUAD[k].label}</span>
              </div>
              <div className="mt-0.5 text-lg font-bold tabular-nums text-white">{counts[k]}</div>
              <div className="text-[9px] text-[#6a7da0]">{shown ? Math.round((counts[k] / shown) * 100) : 0}%</div>
            </button>
          ))}
        </div>

        {/* Selected-quadrant member list */}
        <div className="rounded-lg border border-[#1f2a3d] bg-[#111726]">
          <div className="flex items-center justify-between gap-2 border-b border-[#1f2a3d] px-4 py-2.5">
            <div className="flex items-center gap-2">
              <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: QUAD[selectedQuad].color }} />
              <span className="text-[12px] font-semibold text-[#e8eefc]">{QUAD[selectedQuad].label}</span>
              <span className="text-[11px] text-[#6a7da0]">
                {quadMembers.length.toLocaleString()} · {QUAD[selectedQuad].hint}
                {territory !== "ALL" ? ` · ${TERRITORY_LABEL[territory]}` : ""}
              </span>
            </div>
            <button
              onClick={() => downloadCsv(`quadrant-${selectedQuad}-${territory.toLowerCase()}.csv`, quadMembers, selectedQuad)}
              className="shrink-0 rounded-md border border-[#2d3d5c] px-2.5 py-1 text-[11px] text-[#8ab4ff] hover:bg-[#1a2238]"
            >
              ↓ Export CSV
            </button>
          </div>
          <div className="max-h-[430px] overflow-y-auto">
            {quadMembers.length === 0 ? (
              <div className="px-4 py-6 text-center text-[12px] text-[#6a7da0]">No members in this quadrant with the current filters.</div>
            ) : (
              <table className="w-full text-[12px]">
                <thead className="sticky top-0 bg-[#111726]">
                  <tr className="text-left text-[10px] uppercase tracking-wide text-[#6a7da0]">
                    <th className="px-4 py-1.5 font-medium">#</th>
                    <th className="px-2 py-1.5 font-medium">Member</th>
                    <th className="px-2 py-1.5 font-medium text-right">Qual</th>
                    <th className="px-2 py-1.5 font-medium text-right">Eng</th>
                    <th className="px-2 py-1.5 font-medium">Company</th>
                  </tr>
                </thead>
                <tbody>
                  {quadMembers.slice(0, 300).map((p, i) => (
                    <tr key={p.memberId} className="border-t border-[#141c2b] hover:bg-[#0d121e]">
                      <td className="px-4 py-1.5 tabular-nums text-[#6a7da0]">{i + 1}</td>
                      <td className="px-2 py-1.5">
                        {p.eventflowContactId ? (
                          <Link href={`/engagement/${encodeURIComponent("c:" + p.eventflowContactId)}`} className="text-[#cfdaee] hover:text-white hover:underline">
                            {p.name ?? "—"}
                          </Link>
                        ) : (
                          <span className="text-[#cfdaee]">{p.name ?? "—"}</span>
                        )}
                      </td>
                      <td className="px-2 py-1.5 text-right tabular-nums text-[#c4b5fd]">{p.quality}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums text-[#8ab4ff]">{p.engagement.toFixed(1)}</td>
                      <td className="max-w-[150px] truncate px-2 py-1.5 text-[#9bb0d4]" title={p.company ?? undefined}>{p.company ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {quadMembers.length > 300 && (
              <div className="px-4 py-2 text-[11px] text-[#6a7da0]">Showing first 300 — export CSV for the full list.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

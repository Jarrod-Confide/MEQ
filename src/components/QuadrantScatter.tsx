"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
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

export function QuadrantScatter({ points }: { points: QuadrantPoint[] }) {
  const router = useRouter();
  const [qCut, setQCut] = useState(60); // quality cutoff (Gold)
  const [eCut, setECut] = useState(20); // engagement cutoff (scores are p95-normalized, skew low)
  const [excludeDormant, setExcludeDormant] = useState(false);
  const [territory, setTerritory] = useState<Territory | "ALL">("ALL");
  const [spotlight, setSpotlight] = useState(false);

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

  const applyPreset = (p: Preset) => {
    if (p === "default") { setQCut(60); setECut(20); setExcludeDormant(false); setSpotlight(false); }
    if (p === "active") { setExcludeDormant(true); setSpotlight(false); }
    if (p === "spotlight") { setSpotlight(true); }
  };

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_260px]">
      {/* Chart */}
      <div className="rounded-lg border border-[#1f2a3d] bg-[#0b0f17] p-3">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: 520 }}>
          {/* quadrant tint */}
          <rect x={x(eCut)} y={PAD_T} width={x(100) - x(eCut)} height={y(qCut) - PAD_T} fill={QUAD.champions.color} opacity={0.05} />
          <rect x={PAD_L} y={PAD_T} width={x(eCut) - PAD_L} height={y(qCut) - PAD_T} fill={QUAD.priority.color} opacity={0.06} />
          <rect x={x(eCut)} y={y(qCut)} width={x(100) - x(eCut)} height={y(0) - y(qCut)} fill={QUAD.engaged.color} opacity={0.05} />
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
                <title>{`${p.name ?? "—"}${p.company ? " · " + p.company : ""}\nengagement ${p.engagement} · quality ${p.quality}`}</title>
              </circle>
            );
          })}
          {/* axis titles */}
          <text x={PAD_L + PW / 2} y={H - 6} fontSize="11" fill="#9bb0d4" textAnchor="middle">Engagement →</text>
          <text x={14} y={PAD_T + PH / 2} fontSize="11" fill="#9bb0d4" textAnchor="middle" transform={`rotate(-90 14 ${PAD_T + PH / 2})`}>Quality ↑</text>
        </svg>
      </div>

      {/* Controls + readout */}
      <div className="space-y-4">
        <div className="rounded-lg border border-[#1f2a3d] bg-[#111726] p-4">
          <div className="mb-1 text-[11px] uppercase tracking-wide text-[#9bb0d4]">Quadrant cut-points</div>
          <label className="mt-2 block text-[12px] text-[#cfdaee]">
            Quality ≥ <b className="tabular-nums text-white">{qCut}</b>
            <input type="range" min={0} max={100} value={qCut} onChange={(e) => setQCut(+e.target.value)} className="mt-1 w-full accent-[#8ab4ff]" />
          </label>
          <label className="mt-3 block text-[12px] text-[#cfdaee]">
            Engagement ≥ <b className="tabular-nums text-white">{eCut}</b>
            <input type="range" min={0} max={100} value={eCut} onChange={(e) => setECut(+e.target.value)} className="mt-1 w-full accent-[#8ab4ff]" />
          </label>

          <div className="mt-4 flex flex-col gap-2 text-[12px]">
            <label className="flex items-center gap-2 text-[#cfdaee]">
              <input type="checkbox" checked={excludeDormant} onChange={(e) => setExcludeDormant(e.target.checked)} className="accent-[#8ab4ff]" />
              Exclude dormant (engagement = 0)
            </label>
            <label className="flex items-center gap-2 text-[#cfdaee]">
              <input type="checkbox" checked={spotlight} onChange={(e) => setSpotlight(e.target.checked)} className="accent-[#8ab4ff]" />
              Spotlight priority-outreach
            </label>
            <div className="mt-1">
              <span className="text-[#9bb0d4]">Territory </span>
              <select value={territory} onChange={(e) => setTerritory(e.target.value as Territory | "ALL")} className="rounded border border-[#2d3d5c] bg-[#0b0f17] px-2 py-1 text-[12px] text-white">
                <option value="ALL">All</option>
                {TERRITORY_ORDER.map((t) => (<option key={t} value={t}>{TERRITORY_LABEL[t]}</option>))}
              </select>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-1.5">
            {(["default", "active", "spotlight"] as Preset[]).map((p) => (
              <button key={p} onClick={() => applyPreset(p)} className="rounded-md border border-[#2d3d5c] px-2.5 py-1 text-[12px] text-[#9bb0d4] hover:text-white">
                {p === "default" ? "Default" : p === "active" ? "Active only" : "Spotlight"}
              </button>
            ))}
          </div>
        </div>

        {/* Live quadrant counts */}
        <div className="grid grid-cols-2 gap-2">
          {(Object.keys(QUAD) as QuadKey[]).map((k) => (
            <div key={k} className="rounded-md border border-[#1f2a3d] bg-[#0b0f17] p-3">
              <div className="flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: QUAD[k].color }} />
                <span className="text-[11px] text-[#9bb0d4]">{QUAD[k].label}</span>
              </div>
              <div className="mt-1 text-xl font-bold tabular-nums text-white">{counts[k]}</div>
              <div className="text-[10px] text-[#6a7da0]">{shown ? Math.round((counts[k] / shown) * 100) : 0}% · {QUAD[k].hint}</div>
            </div>
          ))}
        </div>
        <div className="text-[11px] text-[#6a7da0]">{shown.toLocaleString()} members shown · click a dot to open their profile</div>
      </div>
    </div>
  );
}

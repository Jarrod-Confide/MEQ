"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { OutreachSegment, OutreachRow } from "@/lib/outreach";
import { TERRITORY_LABEL, TERRITORY_ORDER, type Territory } from "@/lib/territory";
import { TIER_COLOR as ENG_TIER_COLOR } from "./engagement-ui";
import { TIER_COLOR as Q_TIER_COLOR } from "@/lib/quality-tiers";

const TERR_FILTERS: (Territory | "ALL")[] = ["ALL", ...TERRITORY_ORDER];

function csvEscape(v: string | number | null): string {
  if (v == null) return "";
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function downloadCsv(filename: string, rows: OutreachRow[]) {
  const headers = [
    "name", "company", "email", "territory", "qualityScore", "qualityTier",
    "engagementScore", "engagementTier", "deltaScore", "joinedAt", "reason",
    "slackUserId", "circleMemberId",
  ];
  const lines = [headers.join(",")];
  for (const r of rows) {
    lines.push([
      r.name, r.company, r.email, r.territory, r.qualityScore, r.qualityTier,
      r.engagementScore, r.engagementTier, r.deltaScore,
      r.joinedAt ? r.joinedAt.slice(0, 10) : "", r.reason, r.slackUserId, r.circleMemberId,
    ].map(csvEscape).join(","));
  }
  const blob = new Blob([lines.join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function TierPill({ tier, score, kind }: { tier: string | null; score: number | null; kind: "q" | "e" }) {
  if (score == null) return <span className="text-[#6a7da0]">—</span>;
  const color = tier ? (kind === "q" ? Q_TIER_COLOR[tier] : (ENG_TIER_COLOR as Record<string, string>)[tier]) ?? "#6a7da0" : "#6a7da0";
  return (
    <span className="flex items-center gap-1.5">
      <span className="font-semibold tabular-nums text-white">{kind === "e" ? score.toFixed(1) : Math.round(score)}</span>
      {tier && (
        <span className="rounded-full px-1.5 py-0.5 text-[10px] font-semibold" style={{ background: `${color}22`, color }}>
          {tier}
        </span>
      )}
    </span>
  );
}

export function OutreachLists({ segments }: { segments: OutreachSegment[] }) {
  const [territory, setTerritory] = useState<Territory | "ALL">("ALL");
  const [active, setActive] = useState(segments[0]?.key ?? "priority");

  const filtered = useMemo(
    () =>
      segments.map((s) => ({
        ...s,
        rows: territory === "ALL" ? s.rows : s.rows.filter((r) => r.territory === territory),
      })),
    [segments, territory]
  );
  const current = filtered.find((s) => s.key === active) ?? filtered[0];

  return (
    <div>
      {/* Territory filter */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="text-[12px] uppercase tracking-wide text-[#9bb0d4]">Territory</span>
        {TERR_FILTERS.map((t) => (
          <button
            key={t}
            onClick={() => setTerritory(t)}
            className={`rounded-md px-2.5 py-1 text-[13px] ${
              territory === t ? "bg-[#8ab4ff] text-[#0b0f17]" : "border border-[#2d3d5c] text-[#9bb0d4] hover:text-white"
            }`}
          >
            {t === "ALL" ? "All" : TERRITORY_LABEL[t]}
          </button>
        ))}
      </div>

      {/* Segment tabs */}
      <div className="mb-4 flex flex-wrap gap-2">
        {filtered.map((s) => (
          <button
            key={s.key}
            onClick={() => setActive(s.key)}
            className={`rounded-md border px-3 py-1.5 text-[13px] ${
              active === s.key ? "border-[#2d3d5c] bg-[#1a2238] text-white" : "border-[#1f2a3d] text-[#9bb0d4] hover:text-white"
            }`}
          >
            {s.label} <span className="ml-1 tabular-nums text-[#6a7da0]">{s.rows.length}</span>
          </button>
        ))}
      </div>

      {current && (
        <div>
          <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
            <div className="max-w-prose">
              <div className="text-[13px] text-[#cfdaee]">{current.description}</div>
              <div className="mt-1 text-[12px] text-[#6a7da0]">
                <b className="text-[#9bb0d4]">Suggested action:</b> {current.action}
              </div>
            </div>
            <button
              onClick={() => downloadCsv(`outreach-${current.key}-${territory.toLowerCase()}.csv`, current.rows)}
              disabled={current.rows.length === 0}
              className="rounded-md border border-[#2d3d5c] px-3 py-1.5 text-[13px] text-[#9bb0d4] hover:text-white disabled:opacity-40"
            >
              ↓ Export CSV ({current.rows.length})
            </button>
          </div>

          <div className="overflow-x-auto rounded-lg border border-[#1f2a3d]">
            <table className="w-full border-collapse text-[13px]">
              <thead>
                <tr className="bg-[#111726] text-left text-[11px] uppercase tracking-wide text-[#9bb0d4]">
                  <th className="px-3 py-2.5 font-medium">#</th>
                  <th className="px-3 py-2.5 font-medium">Member</th>
                  <th className="px-3 py-2.5 font-medium">Company</th>
                  <th className="px-3 py-2.5 font-medium">Terr.</th>
                  <th className="px-3 py-2.5 font-medium">Quality</th>
                  <th className="px-3 py-2.5 font-medium">Engagement</th>
                  <th className="px-3 py-2.5 font-medium">Why</th>
                  <th className="px-3 py-2.5 font-medium">Contact</th>
                </tr>
              </thead>
              <tbody>
                {current.rows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-3 py-8 text-center text-[#6a7da0]">
                      No members in this segment{territory !== "ALL" ? ` for ${TERRITORY_LABEL[territory]}` : ""}.
                    </td>
                  </tr>
                ) : (
                  current.rows.slice(0, 200).map((r, i) => (
                    <tr key={`${r.memberId ?? r.name}-${i}`} className="border-t border-[#161e2e] hover:bg-[#111726]">
                      <td className="px-3 py-2 tabular-nums text-[#6a7da0]">{i + 1}</td>
                      <td className="px-3 py-2">
                        {r.memberId ? (
                          <Link prefetch={false} href={`/engagement/${encodeURIComponent("c:" + r.memberId)}`} className="text-[#cfdaee] hover:text-[#8ab4ff] hover:underline">
                            {r.name ?? "—"}
                          </Link>
                        ) : (
                          <span className="text-[#cfdaee]">{r.name ?? "—"}</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-[#9bb0d4]">{r.company ?? "—"}</td>
                      <td className="px-3 py-2 text-[#9bb0d4]">{r.territory}</td>
                      <td className="px-3 py-2"><TierPill tier={r.qualityTier} score={r.qualityScore} kind="q" /></td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <TierPill tier={r.engagementTier} score={r.engagementScore} kind="e" />
                          {r.deltaScore != null && r.deltaScore !== 0 && (
                            <span className="text-[11px] tabular-nums" style={{ color: r.deltaScore > 0 ? "#22c55e" : "#ef4444" }}>
                              {r.deltaScore > 0 ? "▲" : "▼"}{Math.abs(r.deltaScore)}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-[12px] text-[#9bb0d4]">{r.reason}</td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2 text-[11px]">
                          {r.email ? (
                            <a href={`mailto:${r.email}`} className="text-[#8ab4ff] hover:underline" title={r.email}>email</a>
                          ) : null}
                          {r.slackUserId && <span className="rounded bg-[#1a2238] px-1.5 py-0.5 text-[#9bb0d4]" title={r.slackUserId}>Slack</span>}
                          {r.circleMemberId && <span className="rounded bg-[#1a2238] px-1.5 py-0.5 text-[#9bb0d4]">Circle</span>}
                          {!r.email && !r.slackUserId && !r.circleMemberId && <span className="text-[#6a7da0]">—</span>}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {current.rows.length > 200 && (
            <div className="mt-2 text-[11px] text-[#6a7da0]">Showing first 200 of {current.rows.length} — export CSV for the full list.</div>
          )}
        </div>
      )}
    </div>
  );
}

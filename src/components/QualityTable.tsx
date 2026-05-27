"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { QualityRow } from "@/lib/quality-data";

type FilterKey = "all" | "high" | "fortune" | "self" | "ceo" | "clevel";

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "high", label: "High quality" },
  { key: "fortune", label: "Fortune 2000" },
  { key: "ceo", label: "Reports to CEO" },
  { key: "clevel", label: "C-Level" },
  { key: "self", label: "Self-employed" },
];

const EMPLOYMENT_LABEL: Record<string, string> = {
  employed: "Employed",
  self_employed: "Self-employed",
  in_transition: "In transition",
  unknown: "—",
};

function matches(r: QualityRow, f: FilterKey): boolean {
  switch (f) {
    case "high":
      return r.isHighQuality;
    case "fortune":
      return r.isFortune2000;
    case "self":
      return r.employmentType === "self_employed";
    case "ceo":
      return r.tags.includes("reports_to_ceo");
    case "clevel":
      return r.tags.includes("c_level");
    default:
      return true;
  }
}

export function QualityTable({ rows }: { rows: QualityRow[] }) {
  const [filter, setFilter] = useState<FilterKey>("all");
  const [q, setQ] = useState("");

  const view = useMemo(() => {
    return rows.filter((r) => {
      if (!matches(r, filter)) return false;
      if (q.trim()) {
        const hay = `${r.name ?? ""} ${r.company ?? ""}`.toLowerCase();
        if (!hay.includes(q.toLowerCase())) return false;
      }
      return true;
    });
  }, [rows, filter, q]);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`rounded-md px-2.5 py-1 text-[13px] ${
              filter === f.key
                ? "bg-[#8ab4ff] text-[#0b0f17]"
                : "border border-[#2d3d5c] text-[#9bb0d4] hover:text-white"
            }`}
          >
            {f.label}
          </button>
        ))}
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search name or company…"
          className="ml-auto w-64 rounded-md border border-[#1f2a3d] bg-[#0b0f17] px-3 py-1.5 text-[13px] text-white placeholder:text-[#6a7da0] focus:border-[#8ab4ff] focus:outline-none"
        />
      </div>

      <div className="overflow-x-auto rounded-lg border border-[#1f2a3d]">
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr className="bg-[#111726] text-left text-[11px] uppercase tracking-wide text-[#9bb0d4]">
              <th className="px-3 py-2.5 font-medium">#</th>
              <th className="px-3 py-2.5 font-medium">Member</th>
              <th className="px-3 py-2.5 font-medium">Company</th>
              <th className="px-3 py-2.5 font-medium">Co. size</th>
              <th className="px-3 py-2.5 font-medium">Seniority</th>
              <th className="px-3 py-2.5 font-medium">Reports to</th>
              <th className="px-3 py-2.5 font-medium">Team</th>
              <th className="px-3 py-2.5 font-medium">Employment</th>
              <th className="px-3 py-2.5 font-medium">Quality</th>
            </tr>
          </thead>
          <tbody>
            {view.map((r, i) => (
              <tr key={r.memberId} className="border-t border-[#161e2e] hover:bg-[#111726]">
                <td className="px-3 py-2 tabular-nums text-[#6a7da0]">{i + 1}</td>
                <td className="px-3 py-2">
                  <Link
                    href={`/engagement/${encodeURIComponent("c:" + r.memberId)}`}
                    className="text-[#cfdaee] hover:text-[#8ab4ff] hover:underline"
                  >
                    {r.name ?? "—"}
                  </Link>
                </td>
                <td className="px-3 py-2 text-[#cfdaee]">
                  {r.company ?? "—"}
                  {r.isFortune2000 && (
                    <span
                      className="ml-2 rounded px-1.5 py-0.5 text-[10px] font-semibold"
                      style={{ background: "#a78bfa22", color: "#a78bfa" }}
                      title="Fortune 2000"
                    >
                      F2000
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 text-[#9bb0d4]">{r.companySize ?? "—"}</td>
                <td className="px-3 py-2 text-[#9bb0d4]">
                  {r.seniority && r.seniority !== "N/A" ? r.seniority : "—"}
                </td>
                <td className="px-3 py-2 text-[#9bb0d4]">
                  {r.reportingTo && !["N/A", "None of the Above"].includes(r.reportingTo) ? (
                    <span
                      className={
                        r.reportingTo === "CEO" || r.reportingTo === "Board"
                          ? "font-medium text-[#cfdaee]"
                          : ""
                      }
                    >
                      {r.reportingTo}
                    </span>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-3 py-2 text-[#9bb0d4]">
                  {r.teamSize && r.teamSize !== "N/A" ? r.teamSize : "—"}
                </td>
                <td className="px-3 py-2 text-[#9bb0d4]">
                  {EMPLOYMENT_LABEL[r.employmentType ?? "unknown"] ?? "—"}
                </td>
                <td className="px-3 py-2">
                  {r.isHighQuality ? (
                    <span
                      className="rounded-full px-2 py-0.5 text-[11px] font-semibold"
                      style={{ background: "#22c55e22", color: "#22c55e" }}
                    >
                      High
                    </span>
                  ) : (
                    <span className="text-[#6a7da0]">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-2 text-[11px] text-[#6a7da0]">
        {view.length} members shown · &quot;High&quot; = works for a Fortune 2000 company (v1
        definition)
      </div>
    </div>
  );
}

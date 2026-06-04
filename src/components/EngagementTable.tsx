"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { MemberScore, Dimension } from "@/lib/engagement";
import { TierBadge, DimBar, TIER_COLOR } from "./engagement-ui";
import { TIER_COLOR as QUALITY_TIER_COLOR } from "@/lib/quality-tiers";

type SortKey = "total" | Dimension | "name" | "quality";

const DIM_COLS: { key: Dimension; label: string }[] = [
  { key: "events", label: "Events" },
  { key: "contribution", label: "Contrib" },
  { key: "reciprocity", label: "Recip" },
  { key: "depth", label: "Depth" },
  { key: "reach", label: "Reach" },
  { key: "presence", label: "Pres" },
  { key: "connector", label: "Connect" },
];

export function EngagementTable({ members }: { members: MemberScore[] }) {
  const [sort, setSort] = useState<SortKey>("total");
  const [asc, setAsc] = useState(false);
  const [q, setQ] = useState("");

  const rows = useMemo(() => {
    const filtered = q.trim()
      ? members.filter((m) => m.name.toLowerCase().includes(q.toLowerCase()))
      : members;
    const dir = asc ? 1 : -1;
    const sorted = [...filtered].sort((a, b) => {
      if (sort === "name") {
        return dir * a.name.toLowerCase().localeCompare(b.name.toLowerCase());
      }
      // Numeric / nullable cols (quality can be null for Slack-only members).
      let av: number | null;
      let bv: number | null;
      if (sort === "total") {
        av = a.total;
        bv = b.total;
      } else if (sort === "quality") {
        av = a.qualityScore ?? null;
        bv = b.qualityScore ?? null;
      } else {
        av = a.dimensions[sort];
        bv = b.dimensions[sort];
      }
      if (av == null && bv == null) return 0;
      if (av == null) return 1; // nulls last regardless of direction
      if (bv == null) return -1;
      return dir * (av - bv);
    });
    return sorted;
  }, [members, sort, asc, q]);

  const onSort = (key: SortKey) => {
    if (sort === key) setAsc(!asc);
    else {
      setSort(key);
      setAsc(key === "name");
    }
  };

  const arrow = (key: SortKey) => (sort === key ? (asc ? " ↑" : " ↓") : "");

  return (
    <div>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search member…"
        className="mb-3 w-64 rounded-md border border-[#1f2a3d] bg-[#0b0f17] px-3 py-1.5 text-[13px] text-white placeholder:text-[#6a7da0] focus:border-[#8ab4ff] focus:outline-none"
      />
      <div className="overflow-x-auto rounded-lg border border-[#1f2a3d]">
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr className="bg-[#111726] text-left text-[11px] uppercase tracking-wide text-[#9bb0d4]">
              <th className="px-3 py-2.5 font-medium">#</th>
              <th
                className="cursor-pointer px-3 py-2.5 font-medium hover:text-white"
                onClick={() => onSort("name")}
              >
                Member{arrow("name")}
              </th>
              <th
                className="cursor-pointer px-3 py-2.5 font-medium hover:text-white"
                onClick={() => onSort("total")}
              >
                Score{arrow("total")}
              </th>
              <th className="px-3 py-2.5 font-medium">Tier</th>
              {DIM_COLS.map((d) => (
                <th
                  key={d.key}
                  className="cursor-pointer px-3 py-2.5 font-medium hover:text-white"
                  onClick={() => onSort(d.key)}
                  style={{ minWidth: 78 }}
                >
                  {d.label}
                  {arrow(d.key)}
                </th>
              ))}
              <th className="px-3 py-2.5 font-medium" title="posts / replies / reactions given / attended">
                Activity
              </th>
              <th
                className="cursor-pointer px-3 py-2.5 font-medium hover:text-white"
                onClick={() => onSort("quality")}
              >
                Quality{arrow("quality")}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((m, i) => (
              <tr
                key={m.key}
                className="border-t border-[#161e2e] hover:bg-[#111726]"
              >
                <td className="px-3 py-2 tabular-nums text-[#6a7da0]">{i + 1}</td>
                <td className="px-3 py-2">
                  <Link
                    href={`/engagement/${encodeURIComponent(m.key)}`}
                    className="text-[#cfdaee] hover:text-[#8ab4ff] hover:underline"
                  >
                    {m.name}
                  </Link>
                  {!m.matched && (
                    <span
                      className="ml-2 text-[10px] text-[#6a7da0]"
                      title="Active in Slack/Circle but not matched to an EventFlow contact"
                    >
                      slack-only
                    </span>
                  )}
                </td>
                <td className="px-3 py-2">
                  <span className="font-semibold tabular-nums text-white">
                    {m.total.toFixed(1)}
                  </span>
                </td>
                <td className="px-3 py-2">
                  <TierBadge tier={m.tier} />
                </td>
                {DIM_COLS.map((d) => (
                  <td key={d.key} className="px-3 py-2">
                    <div className="flex items-center gap-1.5">
                      <DimBar value={m.dimensions[d.key]} color={TIER_COLOR[m.tier]} />
                      <span className="w-7 shrink-0 text-right tabular-nums text-[11px] text-[#9bb0d4]">
                        {Math.round(m.dimensions[d.key])}
                      </span>
                    </div>
                  </td>
                ))}
                <td className="px-3 py-2 tabular-nums text-[11px] text-[#9bb0d4]">
                  {m.signals.posts}p · {m.signals.replies}r · {m.signals.reactionsGiven}rx ·{" "}
                  {m.signals.eventsAttended}🎟
                </td>
                <td className="px-3 py-2">
                  {m.qualityScore != null ? (
                    <span className="flex items-center gap-1.5">
                      <span className="font-semibold tabular-nums text-white">
                        {m.qualityScore}
                      </span>
                      {m.qualityTier && (
                        <span
                          className="rounded-full px-1.5 py-0.5 text-[10px] font-semibold"
                          style={{
                            background: `${QUALITY_TIER_COLOR[m.qualityTier] ?? "#6a7da0"}22`,
                            color: QUALITY_TIER_COLOR[m.qualityTier] ?? "#6a7da0",
                          }}
                        >
                          {m.qualityTier}
                        </span>
                      )}
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
        {rows.length} members · p = posts, r = replies, rx = reactions given, 🎟 = events attended
      </div>
    </div>
  );
}

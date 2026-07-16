"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { RegionMember } from "@/lib/region-data";
import { TierBadge, TIER_COLOR } from "./engagement-ui";
import { TIER_COLOR as QUALITY_TIER_COLOR } from "@/lib/quality-tiers";
import type { Tier } from "@/lib/engagement";

type SortKey = "rank" | "name" | "total" | "quality" | "company" | "city";

/** Sortable most-engaged-members table for a region drill-in. */
export function RegionMemberTable({ members }: { members: RegionMember[] }) {
  const [sort, setSort] = useState<SortKey>("total");
  const [asc, setAsc] = useState(false);

  // Rank by engagement (stable), independent of the current sort.
  const rankByKey = useMemo(() => {
    const m = new Map<string, number>();
    [...members]
      .sort((a, b) => b.total - a.total)
      .forEach((x, i) => m.set(x.key, i + 1));
    return m;
  }, [members]);

  const rows = useMemo(() => {
    const dir = asc ? 1 : -1;
    return [...members].sort((a, b) => {
      if (sort === "rank") return dir * ((rankByKey.get(a.key) ?? 0) - (rankByKey.get(b.key) ?? 0));
      if (sort === "name") return dir * a.name.toLowerCase().localeCompare(b.name.toLowerCase());
      if (sort === "total") return dir * (a.total - b.total);
      if (sort === "quality") {
        const av = a.qualityScore, bv = b.qualityScore;
        if (av == null && bv == null) return 0;
        if (av == null) return 1; // nulls last regardless of direction
        if (bv == null) return -1;
        return dir * (av - bv);
      }
      // string / nullable cols
      const av = (sort === "company" ? a.company : a.city) ?? "";
      const bv = (sort === "company" ? b.company : b.city) ?? "";
      if (!av && !bv) return 0;
      if (!av) return 1;
      if (!bv) return -1;
      return dir * av.toLowerCase().localeCompare(bv.toLowerCase());
    });
  }, [members, sort, asc, rankByKey]);

  const onSort = (key: SortKey) => {
    if (sort === key) setAsc(!asc);
    else {
      setSort(key);
      setAsc(key === "name" || key === "company" || key === "city" || key === "rank");
    }
  };
  const arrow = (key: SortKey) => (sort === key ? (asc ? " ↑" : " ↓") : "");
  const th = (key: SortKey, label: string) => (
    <th className="cursor-pointer px-3 py-2 font-medium hover:text-white" onClick={() => onSort(key)}>
      {label}
      {arrow(key)}
    </th>
  );

  if (members.length === 0) {
    return <div className="px-5 py-8 text-center text-[13px] text-[#6a7da0]">No members in this region.</div>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[13px]">
        <thead>
          <tr className="text-left text-[11px] uppercase tracking-wide text-[#6a7da0]">
            <th className="cursor-pointer px-5 py-2 font-medium hover:text-white" onClick={() => onSort("rank")}>
              #{arrow("rank")}
            </th>
            {th("name", "Member")}
            {th("total", "Engagement")}
            {th("quality", "Quality")}
            {th("company", "Company")}
            {th("city", "City")}
            <th className="px-3 py-2 font-medium">Contact</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((m) => (
            <tr key={m.key} className="border-t border-[#141c2b] hover:bg-[#0d121e]">
              <td className="px-5 py-2 tabular-nums text-[#6a7da0]">{rankByKey.get(m.key)}</td>
              <td className="px-3 py-2">
                <Link prefetch={false} href={`/engagement/${encodeURIComponent(m.key)}`} className="text-[#cfdaee] hover:text-white hover:underline">
                  {m.name}
                </Link>
              </td>
              <td className="px-3 py-2">
                <div className="flex items-center gap-2">
                  <span className="tabular-nums font-semibold" style={{ color: TIER_COLOR[(m.tier as Tier)] ?? "#cfdaee" }}>
                    {m.total.toFixed(1)}
                  </span>
                  <TierBadge tier={m.tier as Tier} />
                </div>
              </td>
              <td className="px-3 py-2">
                {m.qualityScore != null ? (
                  <span className="tabular-nums" style={{ color: QUALITY_TIER_COLOR[m.qualityTier ?? "Unranked"] ?? "#6a7da0" }}>
                    {m.qualityScore}
                    {m.qualityTier ? <span className="ml-1 text-[11px] text-[#6a7da0]">{m.qualityTier}</span> : null}
                  </span>
                ) : (
                  <span className="text-[#6a7da0]">—</span>
                )}
              </td>
              <td className="px-3 py-2 text-[#9bb0d4]">{m.company ?? "—"}</td>
              <td className="px-3 py-2 text-[#9bb0d4]">{m.city ?? "—"}</td>
              <td className="px-3 py-2">
                {m.email ? (
                  <a href={`mailto:${m.email}`} className="text-[#8ab4ff] hover:underline">{m.email}</a>
                ) : (
                  <span className="text-[#6a7da0]">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

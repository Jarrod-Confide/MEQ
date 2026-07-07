"use client";

import { useEffect, useRef } from "react";
import type { CityTrend } from "@/lib/region-data";

const LEAFLET_CSS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";

// Trend-first coloring: is this metro heating up or cooling off (4-week avg)?
const UP = "#22c55e";
const DOWN = "#ef4444";
const FLAT = "#8ab4ff";
const NO_DATA = "#4b5a75";
const FLAT_BAND = 1; // |delta| ≤ 1 point reads as flat

function trendColor(t: CityTrend): string {
  if (t.delta == null) return NO_DATA;
  if (t.delta > FLAT_BAND) return UP;
  if (t.delta < -FLAT_BAND) return DOWN;
  return FLAT;
}

function deltaLabel(t: CityTrend): string {
  if (t.delta == null) return "no 4-week history yet";
  const arrow = t.delta > FLAT_BAND ? "▲" : t.delta < -FLAT_BAND ? "▼" : "→";
  return `${arrow} ${t.delta > 0 ? "+" : ""}${t.delta.toFixed(1)} vs 4 weeks ago`;
}

/**
 * Region hotspot map — city bubbles sized by member count, colored by
 * 4-week engagement trend (green heating up / red cooling / blue flat).
 */
export function RegionTrendMap({ cities }: { cities: CityTrend[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<unknown>(null);

  useEffect(() => {
    if (!containerRef.current || cities.length === 0) return;
    let cancelled = false;

    (async () => {
      if (!document.querySelector(`link[href="${LEAFLET_CSS}"]`)) {
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = LEAFLET_CSS;
        document.head.appendChild(link);
      }
      const L = (await import("leaflet")).default;
      if (cancelled || !containerRef.current || mapRef.current) return;

      const map = L.map(containerRef.current, { minZoom: 2, maxZoom: 8 });
      mapRef.current = map;
      L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png", {
        attribution: "© OpenStreetMap © CARTO",
        subdomains: "abcd",
        maxZoom: 8,
      }).addTo(map);

      const bounds = L.latLngBounds(cities.map((c) => [c.lat, c.lng] as [number, number]));
      map.fitBounds(bounds.pad(0.25));

      for (const c of cities) {
        L.circleMarker([c.lat, c.lng], {
          radius: 5 + Math.sqrt(c.members) * 2,
          fillColor: trendColor(c),
          color: "#0b0f17",
          weight: 1,
          opacity: 1,
          fillOpacity: 0.85,
        })
          .bindTooltip(
            `<b>${c.city}</b> · ${c.members} members<br/>` +
              `avg engagement ${c.avgNow != null ? c.avgNow.toFixed(1) : "—"}<br/>` +
              `<span style="color:${trendColor(c)}">${deltaLabel(c)}</span>` +
              (c.scoredNow ? `<br/><span style="color:#6a7da0">${c.scoredNow} scored this week</span>` : ""),
            { sticky: true }
          )
          .addTo(map);
      }
    })();

    return () => {
      cancelled = true;
      const map = mapRef.current as { remove: () => void } | null;
      if (map) {
        map.remove();
        mapRef.current = null;
      }
    };
  }, [cities]);

  if (cities.length === 0) {
    return <div className="flex h-full items-center justify-center text-[13px] text-[#6a7da0]">No mapped cities in this region.</div>;
  }

  return (
    <div className="relative h-full w-full">
      <div className="absolute bottom-3 left-3 z-[1000] rounded-md border border-[#2d3d5c] bg-[#0b0f17]/95 px-3 py-2 shadow-lg">
        <div className="mb-1 text-[10px] uppercase tracking-wide text-[#6a7da0]">4-week engagement trend</div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[#cfdaee]">
          <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full" style={{ background: UP }} /> heating up</span>
          <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full" style={{ background: DOWN }} /> cooling</span>
          <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full" style={{ background: FLAT }} /> flat</span>
          <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full" style={{ background: NO_DATA }} /> no history</span>
        </div>
        <div className="mt-1 text-[10px] text-[#6a7da0]">bubble size = members · snapshots taken weekly (Mondays)</div>
      </div>
      <div ref={containerRef} className="h-full w-full" />
    </div>
  );
}

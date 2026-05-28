"use client";

import { useEffect, useRef, useState } from "react";
import type { CityPoint } from "@/lib/members";

const LEAFLET_CSS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";

type View = "density" | "quality" | "engagement" | "priority";

const VIEWS: { key: View; label: string; help: string }[] = [
  { key: "density", label: "Density", help: "color = member count" },
  { key: "quality", label: "Quality", help: "color = avg quality tier" },
  { key: "engagement", label: "Engagement", help: "color = avg engagement tier" },
  { key: "priority", label: "Priority", help: "color = high-quality + low-engagement count" },
];

// ── Color scales (one per view) ──
function densityColor(n: number) {
  if (n >= 100) return "#ef4444";
  if (n >= 40) return "#facc15";
  if (n >= 10) return "#22c55e";
  return "#60a5fa";
}
function qualityColor(s: number | null) {
  if (s == null) return "#6a7da0";
  if (s >= 80) return "#c4b5fd"; // Platinum
  if (s >= 60) return "#fbbf24"; // Gold
  if (s >= 40) return "#cbd5e1"; // Silver
  if (s >= 20) return "#d8956b"; // Bronze
  return "#6a7da0";
}
function engagementColor(s: number | null) {
  if (s == null) return "#6a7da0";
  if (s >= 80) return "#a78bfa"; // Champion
  if (s >= 60) return "#22c55e"; // Active
  if (s >= 40) return "#60a5fa"; // Engaged
  if (s >= 20) return "#facc15"; // Light
  return "#6a7da0"; // Dormant
}
function priorityColor(n: number) {
  if (n >= 8) return "#ef4444";
  if (n >= 4) return "#fb923c";
  if (n >= 1) return "#facc15";
  return "#1a2238"; // none → dim
}

function colorFor(view: View, p: CityPoint) {
  switch (view) {
    case "quality":
      return qualityColor(p.avgQuality);
    case "engagement":
      return engagementColor(p.avgEngagement);
    case "priority":
      return priorityColor(p.priority);
    default:
      return densityColor(p.members);
  }
}

function radiusFor(p: CityPoint) {
  return 4 + Math.sqrt(p.members) * 2.2;
}

// ── Per-view legend ──
const LEGENDS: Record<View, { swatch: string; label: string }[]> = {
  density: [
    { swatch: "#60a5fa", label: "1–10" },
    { swatch: "#22c55e", label: "10–40" },
    { swatch: "#facc15", label: "40–100" },
    { swatch: "#ef4444", label: "100+" },
  ],
  quality: [
    { swatch: "#6a7da0", label: "Unranked" },
    { swatch: "#d8956b", label: "Bronze" },
    { swatch: "#cbd5e1", label: "Silver" },
    { swatch: "#fbbf24", label: "Gold" },
    { swatch: "#c4b5fd", label: "Platinum" },
  ],
  engagement: [
    { swatch: "#6a7da0", label: "Dormant" },
    { swatch: "#facc15", label: "Light" },
    { swatch: "#60a5fa", label: "Engaged" },
    { swatch: "#22c55e", label: "Active" },
    { swatch: "#a78bfa", label: "Champion" },
  ],
  priority: [
    { swatch: "#1a2238", label: "0" },
    { swatch: "#facc15", label: "1–3" },
    { swatch: "#fb923c", label: "4–7" },
    { swatch: "#ef4444", label: "8+" },
  ],
};

function popupHtml(p: CityPoint) {
  const q = p.avgQuality != null ? `${p.avgQuality}` : "—";
  const e = p.avgEngagement != null ? `${p.avgEngagement}` : "—";
  return `
    <b>${p.name}</b><br/>
    <span style="color:#9bb0d4">${p.members} members</span><br/>
    avg quality: <b>${q}</b> · avg engagement: <b>${e}</b><br/>
    <span style="color:#c4b5fd">${p.highQuality} high-quality</span> ·
    <span style="color:#22c55e">${p.champions} champions</span><br/>
    <span style="color:#fb923c">${p.priority} priority outreach</span>
  `;
}

export function MemberBubbleMap({ points }: { points: CityPoint[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<unknown>(null);
  const layerRef = useRef<unknown>(null);
  const [view, setView] = useState<View>("density");

  // One-time init: create the Leaflet map.
  useEffect(() => {
    if (!containerRef.current) return;
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

      const map = L.map(containerRef.current, { worldCopyJump: true }).setView([30, -30], 2);
      mapRef.current = map;
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 18,
        attribution: "© OpenStreetMap",
      }).addTo(map);
    })();

    return () => {
      cancelled = true;
      const map = mapRef.current as { remove: () => void } | null;
      if (map) {
        map.remove();
        mapRef.current = null;
        layerRef.current = null;
      }
    };
  }, []);

  // Re-render the markers layer whenever points or view changes.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !mapRef.current) return;
      const map = mapRef.current as ReturnType<typeof L.map>;

      if (layerRef.current) {
        (layerRef.current as ReturnType<typeof L.layerGroup>).remove();
      }
      const group = L.layerGroup().addTo(map);
      layerRef.current = group;

      for (const p of points) {
        L.circleMarker([p.lat, p.lng], {
          radius: radiusFor(p),
          fillColor: colorFor(view, p),
          color: "#0b0f17",
          weight: 1,
          opacity: 1,
          fillOpacity: 0.82,
        })
          .bindPopup(popupHtml(p))
          .addTo(group);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [points, view]);

  return (
    <div className="relative h-full w-full bg-[#0b0f17]">
      {/* View toggle */}
      <div className="absolute left-3 top-3 z-[1000] flex flex-wrap gap-1 rounded-md border border-[#2d3d5c] bg-[#0b0f17]/95 p-1 shadow-lg">
        {VIEWS.map((v) => (
          <button
            key={v.key}
            onClick={() => setView(v.key)}
            title={v.help}
            className={`rounded px-2.5 py-1 text-[12px] transition ${
              view === v.key
                ? "bg-[#8ab4ff] text-[#0b0f17]"
                : "text-[#cfdaee] hover:bg-[#1a2238]"
            }`}
          >
            {v.label}
          </button>
        ))}
      </div>

      {/* Per-view legend */}
      <div className="absolute bottom-3 left-3 z-[1000] rounded-md border border-[#2d3d5c] bg-[#0b0f17]/95 px-3 py-2 shadow-lg">
        <div className="mb-1 text-[10px] uppercase tracking-wide text-[#6a7da0]">
          {VIEWS.find((v) => v.key === view)?.help}
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {LEGENDS[view].map((l) => (
            <span key={l.label} className="flex items-center gap-1.5 text-[11px] text-[#cfdaee]">
              <span
                className="inline-block h-3 w-3 rounded-full"
                style={{ background: l.swatch }}
              />
              {l.label}
            </span>
          ))}
        </div>
      </div>

      <div ref={containerRef} className="h-full w-full" />
    </div>
  );
}

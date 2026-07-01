"use client";

import { useEffect, useRef } from "react";
import {
  TERRITORY_COLOR,
  TERRITORY_LABEL,
  TERRITORY_ORDER,
} from "@/lib/territory";

const LEAFLET_CSS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";

export type TerritoryPoint = {
  name: string;
  lat: number;
  lng: number;
  members: number;
  territory: keyof typeof TERRITORY_COLOR;
};

export function TerritoryMap({ points }: { points: TerritoryPoint[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<unknown>(null);

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

      const map = L.map(containerRef.current).setView([42, -96], 3);
      mapRef.current = map;
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 18,
        attribution: "© OpenStreetMap",
      }).addTo(map);

      for (const p of points) {
        L.circleMarker([p.lat, p.lng], {
          radius: 4 + Math.sqrt(p.members) * 2.2,
          fillColor: TERRITORY_COLOR[p.territory],
          color: "#0b0f17",
          weight: 1,
          opacity: 1,
          fillOpacity: 0.82,
        })
          .bindPopup(
            `<b>${p.name}</b><br/><span style="color:#9bb0d4">${p.members} members</span><br/>region: <b>${TERRITORY_LABEL[p.territory]}</b>`
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
  }, [points]);

  return (
    <div className="relative h-full w-full bg-[#0b0f17]">
      <div className="absolute bottom-3 left-3 z-[1000] rounded-md border border-[#2d3d5c] bg-[#0b0f17]/95 px-3 py-2 shadow-lg">
        <div className="mb-1 text-[10px] uppercase tracking-wide text-[#6a7da0]">
          CM region (by home state)
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {TERRITORY_ORDER.map((t) => (
            <span key={t} className="flex items-center gap-1.5 text-[11px] text-[#cfdaee]">
              <span className="inline-block h-3 w-3 rounded-full" style={{ background: TERRITORY_COLOR[t] }} />
              {TERRITORY_LABEL[t]}
            </span>
          ))}
        </div>
      </div>
      <div ref={containerRef} className="h-full w-full" />
    </div>
  );
}

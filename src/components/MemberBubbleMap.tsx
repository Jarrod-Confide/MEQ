"use client";

import { useEffect, useRef } from "react";
import type { CityPoint } from "@/lib/members";

const LEAFLET_CSS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";

function colorFor(n: number) {
  if (n >= 100) return "#ef4444";
  if (n >= 40) return "#facc15";
  if (n >= 10) return "#22c55e";
  return "#60a5fa";
}
function radiusFor(n: number) {
  return 4 + Math.sqrt(n) * 2.2;
}

export function MemberBubbleMap({ points }: { points: CityPoint[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<unknown>(null);

  useEffect(() => {
    if (!ref.current) return;
    let cancelled = false;

    (async () => {
      if (!document.querySelector(`link[href="${LEAFLET_CSS}"]`)) {
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = LEAFLET_CSS;
        document.head.appendChild(link);
      }

      const L = (await import("leaflet")).default;
      if (cancelled || !ref.current) return;
      if (mapRef.current) return;

      const map = L.map(ref.current, { worldCopyJump: true }).setView(
        [30, -30],
        2
      );
      mapRef.current = map;

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 18,
        attribution: "© OpenStreetMap",
      }).addTo(map);

      for (const c of points) {
        L.circleMarker([c.lat, c.lng], {
          radius: radiusFor(c.members),
          fillColor: colorFor(c.members),
          color: "#0b0f17",
          weight: 1,
          opacity: 1,
          fillOpacity: 0.78,
        })
          .bindPopup(`<b>${c.name}</b><br/>${c.members} members`)
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

  return <div ref={ref} className="h-full w-full bg-[#0b0f17]" />;
}

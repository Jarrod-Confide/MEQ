"use client";

import { useEffect, useRef } from "react";
import type * as LT from "leaflet";
import type { FeatureCollection, Geometry } from "geojson";
import {
  TERRITORY_COLOR,
  TERRITORY_LABEL,
  TERRITORY_CM,
  TERRITORY_ORDER,
  type Territory,
} from "@/lib/territory";

const LEAFLET_CSS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";

export type MemberDot = { name: string; lat: number; lng: number; members: number };

type StateProps = { code: string; name: string; region: Territory };

/**
 * US choropleth colored by CM region — each state filled by which manager owns
 * it (state → region baked into /regions-us-states.geojson). Member cities are
 * overlaid as neutral dots so you can see ownership and density at once.
 * Alaska & Hawaii are colored (West); Canadian BC/AB are West but not drawn.
 */
export function RegionChoropleth({ points }: { points: MemberDot[] }) {
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

      const map = L.map(containerRef.current, { minZoom: 3, maxZoom: 7 }).setView([38, -96], 4);
      mapRef.current = map;
      L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png", {
        attribution: "© OpenStreetMap © CARTO",
        subdomains: "abcd",
        maxZoom: 8,
      }).addTo(map);

      const geo = (await fetch("/regions-us-states.geojson").then((r) => r.json())) as FeatureCollection<
        Geometry,
        StateProps
      >;
      if (cancelled) return;

      L.geoJSON<StateProps>(geo, {
        style: (feature): LT.PathOptions => ({
          color: "#0b0f17",
          weight: 1,
          fillColor: TERRITORY_COLOR[feature?.properties.region ?? "OTHER"] ?? "#6a7da0",
          fillOpacity: 0.72,
        }),
        onEachFeature: (feature, lyr: LT.Layer) => {
          const { code, name, region } = feature.properties;
          const cm = TERRITORY_CM[region];
          lyr.bindTooltip(
            `<b>${name}</b> (${code})<br/><span style="color:#9bb0d4">${TERRITORY_LABEL[region]}${cm ? ` · CM ${cm}` : ""}</span>`,
            { sticky: true }
          );
          const path = lyr as LT.Path;
          lyr.on("mouseover", () => path.setStyle({ weight: 2, fillOpacity: 0.9 }));
          lyr.on("mouseout", () => path.setStyle({ weight: 1, fillOpacity: 0.72 }));

          // Permanent 2-letter label for states big enough to hold one.
          const b = (lyr as LT.Polygon).getBounds();
          if ((b.getNorth() - b.getSouth()) * (b.getEast() - b.getWest()) > 6) {
            L.marker(b.getCenter(), {
              interactive: false,
              icon: L.divIcon({
                className: "",
                html: `<span style="color:#0b0f17;font:600 11px system-ui;text-shadow:0 0 3px rgba(255,255,255,.6)">${code}</span>`,
                iconSize: [22, 12],
                iconAnchor: [11, 6],
              }),
            }).addTo(map);
          }
        },
      }).addTo(map);

      // Member locations on top (neutral — the fills carry region color).
      for (const p of points) {
        L.circleMarker([p.lat, p.lng], {
          radius: 3 + Math.sqrt(p.members) * 1.5,
          fillColor: "#e8eefc",
          color: "#0b0f17",
          weight: 1,
          opacity: 1,
          fillOpacity: 0.85,
        })
          .bindTooltip(`<b>${p.name}</b><br/>${p.members} members`, { sticky: true })
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
        <div className="mb-1 text-[10px] uppercase tracking-wide text-[#6a7da0]">CM region</div>
        <div className="flex flex-col gap-1">
          {TERRITORY_ORDER.filter((t) => t !== "OTHER").map((t) => (
            <span key={t} className="flex items-center gap-1.5 text-[11px] text-[#cfdaee]">
              <span className="inline-block h-3 w-3 rounded-sm" style={{ background: TERRITORY_COLOR[t] }} />
              {TERRITORY_LABEL[t]}
              {TERRITORY_CM[t] ? ` · ${TERRITORY_CM[t]}` : ""}
            </span>
          ))}
          <span className="mt-1 max-w-[220px] text-[10px] text-[#6a7da0]">
            AK &amp; HI → West. Canada BC &amp; AB → West (not drawn). White dots = member locations.
          </span>
        </div>
      </div>
      <div ref={containerRef} className="h-full w-full" />
    </div>
  );
}

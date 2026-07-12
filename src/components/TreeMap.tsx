import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import type { StyleSpecification } from "maplibre-gl";
import { Protocol } from "pmtiles";
import "maplibre-gl/dist/maplibre-gl.css";
import { HEIGHT_STOPS } from "@/lib/ramp";

/** Datenausdehnung des Projektgebiets 124018 (aus dem PMTiles-Header). */
const DATA_BOUNDS: [[number, number], [number, number]] = [
  [11.812, 48.4308],
  [12.3131, 48.6514],
];

const BASEMAP_STYLE =
  "https://sgx.geodatenzentrum.de/gdz_basemapde_vektor/styles/bm_web_gry.json";

/** Rueckfallebene, falls basemap.de nicht erreichbar ist. */
const FALLBACK_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution: "© OpenStreetMap-Mitwirkende",
    },
  },
  layers: [{ id: "osm", type: "raster", source: "osm" }],
};

const heightColor = [
  "interpolate",
  ["linear"],
  ["get", "h"],
  ...HEIGHT_STOPS.flat(),
];

function heightFilter(minHeight: number) {
  return minHeight > HEIGHT_STOPS[0][0]
    ? ([">=", ["get", "h"], minHeight] as never)
    : null;
}

export function TreeMap({ minHeight }: { minHeight: number }) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const minHeightRef = useRef(minHeight);
  minHeightRef.current = minHeight;

  useEffect(() => {
    const map = mapRef.current;
    if (map?.getLayer("trees")) map.setFilter("trees", heightFilter(minHeight));
  }, [minHeight]);

  useEffect(() => {
    const protocol = new Protocol();
    maplibregl.addProtocol("pmtiles", protocol.tile);

    let map: maplibregl.Map | undefined;
    let cancelled = false;

    (async () => {
      const style: StyleSpecification | string = await fetch(BASEMAP_STYLE)
        .then((r) => (r.ok ? r.json() : FALLBACK_STYLE))
        .catch(() => FALLBACK_STYLE);
      if (cancelled || !container.current) return;

      map = new maplibregl.Map({
        container: container.current,
        style,
        bounds: DATA_BOUNDS,
        fitBoundsOptions: { padding: 16 },
        minZoom: 8,
        maxZoom: 19,
        maxBounds: [
          [11.65, 48.35],
          [12.48, 48.73],
        ],
        attributionControl: { compact: true },
      });
      mapRef.current = map;
      map.addControl(new maplibregl.NavigationControl({ showCompass: false }));
      map.addControl(
        new maplibregl.GeolocateControl({
          positionOptions: { enableHighAccuracy: true },
        }),
      );
      map.addControl(new maplibregl.ScaleControl(), "bottom-right");

      map.on("load", () => {
        if (!map) return;
        map.addSource("baeume", {
          type: "vector",
          url: `pmtiles://${new URL(`${import.meta.env.BASE_URL}data/baeume.pmtiles`, window.location.href).href}`,
          attribution: "Bäume: Bayerische Vermessungsverwaltung",
        });
        const initialFilter = heightFilter(minHeightRef.current);
        map.addLayer({
          id: "trees",
          type: "circle",
          source: "baeume",
          "source-layer": "trees",
          ...(initialFilter ? { filter: initialFilter } : {}),
          paint: {
            "circle-color": heightColor as never,
            "circle-opacity": 0.85,
            // Radius waechst mit Zoom; ab z14 zusaetzlich leicht mit der
            // Baumhoehe (Zweitkodierung neben der Farbe)
            "circle-radius": [
              "interpolate",
              ["exponential", 1.5],
              ["zoom"],
              8, 0.8,
              11, 1.4,
              13, 2.2,
              14, ["interpolate", ["linear"], ["get", "h"], 5, 1.8, 45, 3.4],
              16, ["interpolate", ["linear"], ["get", "h"], 5, 3, 45, 8],
              19, ["interpolate", ["linear"], ["get", "h"], 5, 8, 45, 24],
            ] as never,
            "circle-stroke-color": "#faf7f2",
            "circle-stroke-opacity": 0.6,
            "circle-stroke-width": [
              "interpolate",
              ["linear"],
              ["zoom"],
              14, 0,
              16, 1,
            ] as never,
          },
        });

        map.on("click", (e) => {
          if (!map) return;
          const pad = 8;
          const features = map.queryRenderedFeatures(
            [
              [e.point.x - pad, e.point.y - pad],
              [e.point.x + pad, e.point.y + pad],
            ],
            { layers: ["trees"] },
          );
          const f = features[0];
          if (!f || f.geometry.type !== "Point") return;
          const { h, g } = f.properties as { h: number; g: number };
          new maplibregl.Popup({ closeButton: false, offset: 10, maxWidth: "240px" })
            .setLngLat(f.geometry.coordinates as [number, number])
            .setHTML(
              `<strong style="font-size:0.95rem">${h.toLocaleString("de-DE", { maximumFractionDigits: 1 })}&thinsp;m hoch</strong>` +
                `<br><span style="color:#6f6b63">Standort ${Math.round(g).toLocaleString("de-DE")}&thinsp;m ü. NHN</span>`,
            )
            .addTo(map);
        });
        map.on("mouseenter", "trees", () => {
          if (map) map.getCanvas().style.cursor = "pointer";
        });
        map.on("mouseleave", "trees", () => {
          if (map) map.getCanvas().style.cursor = "";
        });
      });
    })();

    return () => {
      cancelled = true;
      map?.remove();
      mapRef.current = null;
      maplibregl.removeProtocol("pmtiles");
    };
  }, []);

  // Wrapper uebernimmt die Positionierung: MapLibres Stylesheet ueberschreibt
  // position/inset-Klassen auf dem Container-Element selbst
  return (
    <div className="absolute inset-0">
      <div ref={container} className="h-full w-full" aria-label="Karte der Einzelbäume" />
    </div>
  );
}

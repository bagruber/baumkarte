import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import type { StyleSpecification } from "maplibre-gl";
import { Protocol } from "pmtiles";
import "maplibre-gl/dist/maplibre-gl.css";
import { HEIGHT_STOPS } from "@/lib/ramp";
import { duerreColor, type Ausschnitt } from "@/lib/umwelt";

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

export function TreeMap({
  minHeight,
  showDuerre,
  tagIndex,
  onBoundsChange,
}: {
  minHeight: number;
  showDuerre: boolean;
  tagIndex: number;
  onBoundsChange: (b: Ausschnitt) => void;
}) {
  const boundsCb = useRef(onBoundsChange);
  boundsCb.current = onBoundsChange;
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const showDuerreRef = useRef(showDuerre);
  showDuerreRef.current = showDuerre;
  const tagRef = useRef(tagIndex);
  tagRef.current = tagIndex;
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const map = mapRef.current;
    if (!map?.getLayer("duerre")) return;
    const sichtbar = showDuerre ? "visible" : "none";
    map.setLayoutProperty("duerre", "visibility", sichtbar);
    map.setLayoutProperty("duerre-kante", "visibility", sichtbar);
  }, [showDuerre]);

  useEffect(() => {
    const map = mapRef.current;
    if (map?.getLayer("duerre")) {
      map.setPaintProperty("duerre", "fill-color", duerreColor(tagIndex) as never);
    }
  }, [tagIndex]);
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

      // Startausschnitt so einpassen, dass der Randblock keine Daten verdeckt
      const wide = window.innerWidth >= 640;
      map = new maplibregl.Map({
        container: container.current,
        style,
        bounds: DATA_BOUNDS,
        fitBoundsOptions: {
          padding: wide
            ? { top: 24, right: 24, bottom: 24, left: 340 }
            : { top: 24, right: 24, bottom: 310, left: 24 },
        },
        minZoom: 8,
        maxZoom: 19,
        maxBounds: [
          [11.65, 48.35],
          [12.48, 48.73],
        ],
        // Quellenvermerk steht fest im Randblock (Plate), nicht als Overlay
        attributionControl: false,
      });
      mapRef.current = map;
      map.once("idle", () => {
        if (!cancelled) setLoaded(true);
      });

      // Die Duerreanzeige folgt dem, was man sieht: beim Hineinzoomen
      // zaehlen weniger Rasterzellen, beim Herauszoomen mehr.
      const meldeAusschnitt = () => {
        if (!map || cancelled) return;
        const b = map.getBounds();
        boundsCb.current({
          west: b.getWest(),
          sued: b.getSouth(),
          ost: b.getEast(),
          nord: b.getNorth(),
        });
      };
      map.on("moveend", meldeAusschnitt);
      map.once("load", meldeAusschnitt);
      map.addControl(new maplibregl.NavigationControl({ showCompass: false }));
      map.addControl(
        new maplibregl.GeolocateControl({
          positionOptions: { enableHighAccuracy: true },
        }),
      );
      // mobil deckt der Randblock die untere Kante ab, dort waere der
      // Massstab verdeckt
      map.addControl(new maplibregl.ScaleControl(), wide ? "bottom-right" : "top-left");

      map.on("load", () => {
        if (!map) return;
        map.addSource("baeume", {
          type: "vector",
          url: `pmtiles://${new URL(`${import.meta.env.BASE_URL}data/baeume.pmtiles`, window.location.href).href}`,
        });
        // Duerreflaeche zuunterst, damit Baeume und Beschriftung lesbar
        // bleiben. Echte 4-km-Quadrate mit sichtbarer Zellkante: Das Raster
        // ist grob, und das soll man sehen.
        map.addSource("duerre", {
          type: "geojson",
          data: `${import.meta.env.BASE_URL}data/duerre.geojson`,
        });
        const sichtbar = showDuerreRef.current ? "visible" : "none";
        map.addLayer({
          id: "duerre",
          type: "fill",
          source: "duerre",
          layout: { visibility: sichtbar },
          paint: {
            // Bewusst schwach: Die Ebene soll die Karte tönen, nicht
            // zudecken. Bei flächig gleicher Klasse bleibt ohnehin nur ein
            // Ton übrig — Aussagekraft bekommt sie erst, wenn das Gebiet
            // wächst oder die Dürre fleckig ist.
            "fill-color": duerreColor(tagRef.current) as never,
            "fill-opacity": 0.16,
          },
        });
        // Eigene Linienebene statt fill-outline-color: Letzteres zeichnet
        // nur haarfeine, oft unsichtbare Kanten ohne Breitensteuerung.
        // Die Kante macht sichtbar, wie grob das Raster ist.
        map.addLayer({
          id: "duerre-kante",
          type: "line",
          source: "duerre",
          layout: { visibility: sichtbar },
          paint: {
            "line-color": "#6d0818",
            "line-width": 0.8,
            "line-opacity": 0.35,
          },
        });

        // Blattschnitt: Kante des Projektgebiets, damit der abrupte Rand der
        // Punktwolke als Datengrenze lesbar wird und nicht als Fehler
        const [[w, s], [e, n]] = DATA_BOUNDS;
        map.addSource("extent", {
          type: "geojson",
          data: {
            type: "Feature",
            properties: {},
            geometry: {
              type: "LineString",
              coordinates: [
                [w, s],
                [e, s],
                [e, n],
                [w, n],
                [w, s],
              ],
            },
          },
        });
        map.addLayer({
          id: "extent",
          type: "line",
          source: "extent",
          paint: {
            "line-color": "#968b69",
            "line-width": 1,
            "line-dasharray": [5, 4],
          },
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
              `<div style="font-variant-numeric:tabular-nums">` +
                `<div style="font-size:1.05rem;font-weight:600;line-height:1.15">${h.toLocaleString("de-DE", { maximumFractionDigits: 1 })}&thinsp;m</div>` +
                `<div style="font-size:0.6rem;font-weight:600;letter-spacing:0.14em;text-transform:uppercase;color:#6f6b63;margin-top:2px">Baumhöhe</div>` +
                `<div style="margin-top:6px;padding-top:5px;border-top:1px solid #e4e0d7;font-size:0.72rem;color:#555555">Gelände ${Math.round(g).toLocaleString("de-DE")}&thinsp;m ü.&thinsp;NHN</div>` +
                `</div>`,
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
      {!loaded && (
        <div
          role="status"
          aria-live="polite"
          className="pointer-events-none absolute inset-0 grid place-items-center"
        >
          <p className="eyebrow text-red-700">Karte wird geladen …</p>
        </div>
      )}
    </div>
  );
}

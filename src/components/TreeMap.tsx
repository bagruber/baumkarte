import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import type { StyleSpecification } from "maplibre-gl";
import { Protocol } from "pmtiles";
import { Crosshair, Minus, Plus } from "@phosphor-icons/react";
import { HEIGHT_STOPS } from "@/lib/ramp";
import { papierton } from "@/lib/papierton";
import { duerreColor, wasserColor, type Ausschnitt, type Flaeche } from "@/lib/umwelt";

/** Datenausdehnung des Projektgebiets 124018 (aus dem PMTiles-Header). */
const DATA_BOUNDS: [[number, number], [number, number]] = [
  [11.812, 48.4308],
  [12.3131, 48.6514],
];

const BASEMAP_STYLE =
  "https://sgx.geodatenzentrum.de/gdz_basemapde_vektor/styles/bm_web_gry.json";

/**
 * Rueckfallebene, falls basemap.de nicht erreichbar ist: die graue
 * TopPlusOpen des BKG. Sie bleibt ungetoent — ein Raster laesst sich nicht
 * kanalweise multiplizieren, ohne ihn durch einen Filter zu schicken, und
 * grau auf Creme steht dem Papierton ohnehin nahe. Frueher standen hier die
 * bunten OSM-Kacheln, die neben den Baumgruen-Punkten laut wurden.
 */
const TOPPLUS_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    topplus: {
      type: "raster",
      tiles: [
        "https://sgx.geodatenzentrum.de/wmts_topplus_open/tile/1.0.0/web_grau/default/WEBMERCATOR/{z}/{y}/{x}.png",
      ],
      tileSize: 256,
    },
  },
  layers: [{ id: "topplus", type: "raster", source: "topplus" }],
};

export type Grundkarte = "basemap" | "topplus";

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
  flaeche,
  tagIndex,
  onBoundsChange,
  onGrundkarte,
  onBereit,
}: {
  minHeight: number;
  flaeche: Flaeche;
  tagIndex: number;
  onBoundsChange: (b: Ausschnitt) => void;
  onGrundkarte: (g: Grundkarte) => void;
  onBereit: () => void;
}) {
  const boundsCb = useRef(onBoundsChange);
  boundsCb.current = onBoundsChange;
  const grundCb = useRef(onGrundkarte);
  grundCb.current = onGrundkarte;
  const bereitCb = useRef(onBereit);
  bereitCb.current = onBereit;
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const ortung = useRef<maplibregl.GeolocateControl | null>(null);
  const flaecheRef = useRef(flaeche);
  flaecheRef.current = flaeche;
  const tagRef = useRef(tagIndex);
  tagRef.current = tagIndex;
  // Zoomknoepfe nur mit Maus: am Telefon zoomt man mit zwei Fingern, und die
  // Knoepfe verstellen dort nur die Kartenflaeche (Formsprache-Probe, Punkt 9).
  const [maus] = useState(
    () => window.matchMedia("(hover: hover) and (pointer: fine)").matches,
  );

  useEffect(() => {
    const map = mapRef.current;
    if (!map?.getLayer("duerre")) return;
    // Immer nur eine getoente Flaeche, sonst mischen sich die Farben
    for (const [id, an] of [
      ["duerre", flaeche === "duerre"],
      ["wasser", flaeche === "wasser"],
      ["duerre-kante", flaeche !== "aus"],
    ] as const) {
      map.setLayoutProperty(id, "visibility", an ? "visible" : "none");
    }
    // Kante in der Farbe der jeweiligen Ebene, sonst liegt ein rotes Gitter
    // auf der blauen Wasserfläche
    map.setPaintProperty(
      "duerre-kante",
      "line-color",
      flaeche === "wasser" ? "#2f5f80" : "#6d0818",
    );
  }, [flaeche]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map?.getLayer("duerre")) return;
    map.setPaintProperty("duerre", "fill-color", duerreColor(tagIndex) as never);
    map.setPaintProperty("wasser", "fill-color", wasserColor(tagIndex) as never);
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
      // Der Stil kommt als JSON herein und geht getoent weiter: jede
      // Farbangabe kanalweise mit Creme multipliziert.
      const style: StyleSpecification = await fetch(BASEMAP_STYLE)
        .then((r) => (r.ok ? r.json() : null))
        .then((j) => (j ? papierton(j as StyleSpecification) : TOPPLUS_STYLE))
        .catch(() => TOPPLUS_STYLE);
      if (cancelled || !container.current) return;
      grundCb.current(style === TOPPLUS_STYLE ? "topplus" : "basemap");

      // Ab lg steht die Leiste als eigene Spalte neben der Karte, die Karte
      // braucht dort kein Polster mehr. Am Telefon deckt das Blatt die untere
      // Kante ab.
      const breit = window.innerWidth >= 1024;
      map = new maplibregl.Map({
        container: container.current,
        style,
        bounds: DATA_BOUNDS,
        fitBoundsOptions: {
          padding: breit
            ? { top: 24, right: 24, bottom: 24, left: 24 }
            : { top: 24, right: 24, bottom: 180, left: 24 },
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
        if (!cancelled) bereitCb.current();
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
      // Die Ortung steuert weiter MapLibre, die Knoepfe stehen als eigene
      // Gruppe daneben — nur so tragen sie die Zeichen der Familie.
      ortung.current = new maplibregl.GeolocateControl({
        positionOptions: { enableHighAccuracy: true },
      });
      map.addControl(ortung.current);
      // Meterstab: ab lg unten links neben der Leiste, darunter oben links
      // unter dem Band.
      map.addControl(new maplibregl.ScaleControl(), breit ? "bottom-left" : "top-left");

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
        const start = flaecheRef.current;
        map.addLayer({
          id: "duerre",
          type: "fill",
          source: "duerre",
          layout: { visibility: start === "duerre" ? "visible" : "none" },
          paint: {
            // Bewusst schwach: Die Ebene soll die Karte tönen, nicht
            // zudecken. Bei flächig gleicher Klasse bleibt ohnehin nur ein
            // Ton übrig — Aussagekraft bekommt sie erst, wenn das Gebiet
            // wächst oder die Dürre fleckig ist.
            "fill-color": duerreColor(tagRef.current) as never,
            "fill-opacity": 0.16,
          },
        });
        // Pflanzenverfuegbares Wasser: hat anders als der Duerreindex echte
        // Streuung im Gebiet, darf deshalb etwas kraeftiger auftragen.
        map.addLayer({
          id: "wasser",
          type: "fill",
          source: "duerre",
          layout: { visibility: start === "wasser" ? "visible" : "none" },
          paint: {
            "fill-color": wasserColor(tagRef.current) as never,
            "fill-opacity": 0.3,
          },
        });
        // Eigene Linienebene statt fill-outline-color: Letzteres zeichnet
        // nur haarfeine, oft unsichtbare Kanten ohne Breitensteuerung.
        // Die Kante macht sichtbar, wie grob das Raster ist.
        map.addLayer({
          id: "duerre-kante",
          type: "line",
          source: "duerre",
          layout: { visibility: start === "aus" ? "none" : "visible" },
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
          // Bis zwei Werte ein Zettel am Punkt, mehr gehoerte ins Blatt.
          new maplibregl.Popup({ closeButton: false, offset: 10, maxWidth: "240px" })
            .setLngLat(f.geometry.coordinates as [number, number])
            .setHTML(
              `<div style="font-variant-numeric:lining-nums tabular-nums">` +
                `<div style="font-size:1.05rem;font-weight:600;line-height:1.15">${h.toLocaleString("de-DE", { maximumFractionDigits: 1 })}&thinsp;m</div>` +
                `<div style="font-size:12px;font-weight:600;color:#555555;margin-top:2px">Baumhöhe</div>` +
                `<div style="margin-top:6px;padding-top:5px;border-top:1px solid #e4e0d7;font-size:12px;color:#555555">Gelände ${Math.round(g).toLocaleString("de-DE")}&thinsp;m ü.&thinsp;NHN</div>` +
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
      ortung.current = null;
      maplibregl.removeProtocol("pmtiles");
    };
  }, []);

  // Wrapper uebernimmt die Positionierung: MapLibres Stylesheet ueberschreibt
  // position/inset-Klassen auf dem Container-Element selbst
  return (
    <div className="absolute inset-0">
      <div ref={container} className="h-full w-full" aria-label="Karte der Einzelbäume" />

      {maus ? (
        <div className="absolute right-3 top-3 z-10 flex flex-col overflow-hidden rounded-md border border-ink-frame bg-cream shadow-soft">
          <Kartenknopf label="Hineinzoomen" onClick={() => mapRef.current?.zoomIn()}>
            <Plus size={17} aria-hidden />
          </Kartenknopf>
          <Kartenknopf label="Herauszoomen" onClick={() => mapRef.current?.zoomOut()}>
            <Minus size={17} aria-hidden />
          </Kartenknopf>
          <Kartenknopf label="Meinen Standort zeigen" onClick={() => ortung.current?.trigger()}>
            <Crosshair size={17} aria-hidden />
          </Kartenknopf>
        </div>
      ) : (
        // Am Daumen statt am Rand: der Standort-Knopf sitzt ueber dem Blatt
        // und wandert mit, wenn es aufgezogen wird.
        <button
          type="button"
          aria-label="Meinen Standort zeigen"
          onClick={() => ortung.current?.trigger()}
          style={{ bottom: "calc(var(--blatt-hoehe) + 12px)" }}
          className="absolute right-3 z-10 grid h-[42px] w-[42px] place-items-center rounded-xl border border-ink-frame bg-cream text-ink shadow-soft"
        >
          <Crosshair size={20} aria-hidden />
        </button>
      )}
    </div>
  );
}

function Kartenknopf({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="grid h-[34px] w-[34px] place-items-center text-ink hover:bg-cream-dark [&+&]:border-t [&+&]:border-ink-line"
    >
      {children}
    </button>
  );
}

export type DuerreTag = {
  stand: string;
  smi: number;
  klasse: string;
  wiederkehr_jahre: number | null;
};

export type Umwelt = {
  bodenfeuchte: { aktuell: number; referenz: number | null };
  duerre?: { serie: DuerreTag[]; zellen: number; referenz_zeitraum: string };
};

/** Duerreklassen des UFZ, von mild nach schwer — Leserichtung = Zunahme.
 *  Dieselben Farben nutzt die Kartenebene in TreeMap.tsx. */
export const KLASSEN = [
  { name: "ungewöhnliche Trockenheit", farbe: "#e3c88a" },
  { name: "moderate Dürre", farbe: "#d69a3c" },
  { name: "schwere Dürre", farbe: "#c2662a" },
  { name: "extreme Dürre", farbe: "#a8291f" },
  { name: "außergewöhnliche Dürre", farbe: "#6d0818" },
];

/** Stufenausdruck fuer MapLibre, fuer einen bestimmten Tag der Reihe. */
export function duerreColor(tagIndex: number) {
  return [
    "step",
    ["coalesce", ["get", `d${tagIndex}`], 1],
    KLASSEN[4].farbe,
    0.02, KLASSEN[3].farbe,
    0.05, KLASSEN[2].farbe,
    0.1, KLASSEN[1].farbe,
    0.2, KLASSEN[0].farbe,
    0.3, "rgba(0,0,0,0)",
  ];
}

export function ladeUmwelt(): Promise<Umwelt | null> {
  return fetch(`${import.meta.env.BASE_URL}data/umwelt.json`)
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null);
}

/** Eine Rasterzelle, auf Mittelpunkt und Tageswerte eingedampft. */
export type Zelle = { lon: number; lat: number; werte: (number | null)[] };

/** Zellmittelpunkte aus der Kartenebene, fuer die Auswertung des Ausschnitts. */
export function ladeZellen(): Promise<Zelle[]> {
  return fetch(`${import.meta.env.BASE_URL}data/duerre.geojson`)
    .then((r) => (r.ok ? r.json() : null))
    .then((geo) => {
      if (!geo?.features) return [];
      return geo.features.map((f: any) => {
        const ring = f.geometry.coordinates[0] as [number, number][];
        // Ring hat 5 Punkte, der letzte wiederholt den ersten
        const lon = (ring[0][0] + ring[2][0]) / 2;
        const lat = (ring[0][1] + ring[2][1]) / 2;
        const werte: (number | null)[] = [];
        for (let i = 0; f.properties[`d${i}`] !== undefined; i++) {
          werte.push(f.properties[`d${i}`]);
        }
        return { lon, lat, werte };
      });
    })
    .catch(() => []);
}

export type Ausschnitt = { west: number; sued: number; ost: number; nord: number };

/**
 * Mittlerer SMI der Zellen im sichtbaren Ausschnitt.
 *
 * Bewusst der Ausschnitt statt eines festen Umkreises: Beim Hineinzoomen
 * zaehlen weniger Zellen, beim Herauszoomen mehr. Bleibt nichts uebrig
 * (weit hineingezoomt zwischen zwei Zellmittelpunkten), faellt die naechste
 * Zelle ein, damit die Anzeige nicht leer laeuft.
 */
export function mittelImAusschnitt(
  zellen: Zelle[],
  bounds: Ausschnitt | null,
  tagIndex: number,
): { smi: number; zellen: number } | null {
  if (!zellen.length) return null;
  const werte: number[] = [];
  if (bounds) {
    for (const z of zellen) {
      if (z.lon < bounds.west || z.lon > bounds.ost) continue;
      if (z.lat < bounds.sued || z.lat > bounds.nord) continue;
      const v = z.werte[Math.min(tagIndex, z.werte.length - 1)];
      if (v != null) werte.push(v);
    }
  }
  if (!werte.length && bounds) {
    const mx = (bounds.west + bounds.ost) / 2;
    const my = (bounds.sued + bounds.nord) / 2;
    let beste: Zelle | null = null;
    let dist = Infinity;
    for (const z of zellen) {
      const d = (z.lon - mx) ** 2 + (z.lat - my) ** 2;
      if (d < dist) {
        dist = d;
        beste = z;
      }
    }
    const v = beste?.werte[Math.min(tagIndex, beste.werte.length - 1)];
    if (v != null) werte.push(v);
  }
  if (!werte.length) return null;
  return { smi: werte.reduce((a, b) => a + b, 0) / werte.length, zellen: werte.length };
}

export function smiKlasse(value: number): { name: string; wiederkehr: number | null } {
  if (value < 0.02) return { name: "außergewöhnliche Dürre", wiederkehr: 50 };
  if (value < 0.05) return { name: "extreme Dürre", wiederkehr: 20 };
  if (value < 0.1) return { name: "schwere Dürre", wiederkehr: 10 };
  if (value < 0.2) return { name: "moderate Dürre", wiederkehr: 5 };
  if (value < 0.3) return { name: "ungewöhnliche Trockenheit", wiederkehr: 3 };
  return { name: "keine Dürre", wiederkehr: null };
}

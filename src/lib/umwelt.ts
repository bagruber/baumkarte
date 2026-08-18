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

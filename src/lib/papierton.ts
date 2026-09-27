/**
 * Grundkarte in den Papierton der Familie ziehen (Formsprache-Probe, Punkt 8).
 *
 * Jede Farbangabe im Stil wird kanalweise mit Creme multipliziert. Weiss wird
 * damit zu Creme, Schwarz bleibt Schwarz, und alles dazwischen behaelt seine
 * Ordnung. Das ist derselbe Griff wie `background-blend-mode: multiply`, nur
 * im Stil statt auf der Flaeche: MapLibre zeichnet sonst nichts, was man
 * ueberblenden koennte, ohne auch die Baeume mitzufaerben.
 *
 * Es wird rekursiv durch `layers[].paint` gegangen, samt Ausdruecken
 * (`interpolate`, `match`, `case`), weil Farben dort in den Zweigen stehen.
 * Keine Ebene wird beim Namen angesprochen.
 */
const CREME = [250 / 255, 247 / 255, 242 / 255] as const;

const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
const FUNKTION = /^(rgb|rgba|hsl|hsla)\(\s*([^)]+?)\s*\)$/i;

/** hsl nach rgb, Werte 0 bis 255. */
function hslZuRgb(h: number, s: number, l: number): [number, number, number] {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] =
    h < 60 ? [c, x, 0] :
    h < 120 ? [x, c, 0] :
    h < 180 ? [0, c, x] :
    h < 240 ? [0, x, c] :
    h < 300 ? [x, 0, c] : [c, 0, x];
  return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
}

/** Zahl aus einem Argument, Prozent bezogen auf `voll`. */
function zahl(teil: string, voll: number): number {
  const t = teil.trim();
  return t.endsWith("%") ? (parseFloat(t) / 100) * voll : parseFloat(t);
}

/**
 * Eine einzelne Farbangabe toenen. Liegt keine der sechs Schreibweisen vor,
 * kommt der Wert unveraendert zurueck — dann ist es keine Farbe.
 */
export function toene(wert: string): string {
  const hex = HEX.exec(wert);
  if (hex) {
    const h = hex[1].length === 3 ? [...hex[1]].map((z) => z + z).join("") : hex[1];
    const kanaele = [0, 2, 4].map((i) =>
      Math.round(parseInt(h.slice(i, i + 2), 16) * CREME[i / 2]),
    );
    return "#" + kanaele.map((k) => k.toString(16).padStart(2, "0")).join("");
  }

  const f = FUNKTION.exec(wert);
  if (!f) return wert;
  const teile = f[2].split(/[\s,/]+/);
  if (teile.length < 3) return wert;
  const alpha = teile[3] !== undefined ? zahl(teile[3], 1) : null;

  const roh = f[1].toLowerCase().startsWith("hsl")
    ? hslZuRgb(zahl(teile[0], 360), zahl(teile[1], 1), zahl(teile[2], 1))
    : ([zahl(teile[0], 255), zahl(teile[1], 255), zahl(teile[2], 255)] as [number, number, number]);

  const [r, g, b] = roh.map((k, i) => Math.round(k * CREME[i]));
  return alpha === null ? `rgb(${r}, ${g}, ${b})` : `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Rekursiv durch einen Paint-Block, Ausdruecke eingeschlossen. */
function durch(knoten: unknown): unknown {
  if (typeof knoten === "string") return toene(knoten);
  if (Array.isArray(knoten)) return knoten.map(durch);
  if (knoten && typeof knoten === "object") {
    return Object.fromEntries(Object.entries(knoten).map(([k, v]) => [k, durch(v)]));
  }
  return knoten;
}

/** Den Stil in den Papierton ziehen. Der Stil wird dabei nicht veraendert. */
export function papierton<T extends { layers?: unknown[] }>(style: T): T {
  if (!Array.isArray(style.layers)) return style;
  return {
    ...style,
    layers: style.layers.map((ebene) => {
      const e = ebene as { paint?: unknown };
      return e && typeof e === "object" && e.paint ? { ...e, paint: durch(e.paint) } : ebene;
    }),
  };
}

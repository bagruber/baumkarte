import { useEffect, useState } from "react";

type Umwelt = {
  bodenfeuchte: { aktuell: number; referenz: number | null };
  duerre?: {
    stand: string | null;
    smi: number;
    klasse: string;
    wiederkehr_jahre: number | null;
  };
};

/** Duerreklassen des UFZ, von mild nach schwer — Leserichtung = Zunahme.
 *  Farben synchron zu DUERRE_COLOR in TreeMap.tsx. */
const KLASSEN = [
  { name: "ungewöhnliche Trockenheit", farbe: "#e3c88a" },
  { name: "moderate Dürre", farbe: "#d69a3c" },
  { name: "schwere Dürre", farbe: "#c2662a" },
  { name: "extreme Dürre", farbe: "#a8291f" },
  { name: "außergewöhnliche Dürre", farbe: "#6d0818" },
];

/**
 * Duerrelage im Kartengebiet, taeglich per Action aktualisiert.
 * Fehlt oder bricht die Datei, rendert die Komponente nichts.
 */
export function Bodenfeuchte({
  showLayer,
  onToggleLayer,
}: {
  showLayer: boolean;
  onToggleLayer: (v: boolean) => void;
}) {
  const [data, setData] = useState<Umwelt | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`${import.meta.env.BASE_URL}data/umwelt.json`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  if (!data?.duerre) return null;
  const { stand, klasse, wiederkehr_jahre } = data.duerre;
  const { aktuell, referenz } = data.bodenfeuchte;
  const aktiv = KLASSEN.findIndex((k) => k.name === klasse);
  const [, month, day] = (stand ?? "").split("-");

  return (
    <div className="mt-3.5">
      <div className="flex items-baseline justify-between gap-2">
        <p className="label">Boden im Gebiet</p>
        {day && (
          <p className="text-[0.62rem] tabular-nums text-ink-muted">
            {day}.{month}.
          </p>
        )}
      </div>

      {/* Derselbe Balken ist Statusanzeige und, bei zugeschalteter Flaeche,
          Legende der Karte — die Farben sind dieselben. */}
      <div className="mt-1.5 flex gap-px" role="img" aria-label={`Dürreklasse: ${klasse}`}>
        {KLASSEN.map((k, i) => (
          <div
            key={k.name}
            title={k.name}
            className="h-2 flex-1"
            style={{
              background: showLayer || i <= aktiv ? k.farbe : "var(--color-cream-dark)",
              opacity: showLayer && i !== aktiv ? 0.45 : 1,
              outline: i === aktiv ? "1px solid var(--color-ink)" : undefined,
            }}
          />
        ))}
      </div>
      {showLayer && (
        <div className="mt-0.5 flex justify-between text-[0.55rem] uppercase tracking-[0.1em] text-ink-muted">
          <span>mild</span>
          <span>4-km-Raster</span>
          <span>schwer</span>
        </div>
      )}

      <p className="mt-1 text-[0.7rem] font-semibold leading-snug text-red-700">{klasse}</p>
      <p className="text-[0.62rem] leading-snug text-ink-muted">
        {wiederkehr_jahre ? `sonst nur alle ${wiederkehr_jahre} Jahre so trocken, ` : ""}
        Bodenwasser {aktuell}&thinsp;%
        {referenz != null ? `, um diese Zeit sonst ${referenz} %` : ""}
      </p>

      <label className="mt-2 flex cursor-pointer items-center gap-2 text-[0.7rem] font-semibold text-ink-soft hover:text-ink">
        <input
          type="checkbox"
          checked={showLayer}
          onChange={(e) => onToggleLayer(e.target.checked)}
          className="h-3 w-3 cursor-pointer"
          style={{ accentColor: "#6d0818" }}
        />
        Fläche auf der Karte zeigen
      </label>
    </div>
  );
}

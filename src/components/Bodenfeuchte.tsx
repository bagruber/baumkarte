import { useEffect, useState } from "react";

type Umwelt = {
  stand: string;
  station: { name: string; entfernung_km: number };
  bodenfeuchte: {
    aktuell: number;
    referenz: number | null;
    referenz_zeitraum: string | null;
    trockenere_vergleichstage: number;
    vergleichstage: number;
  };
};

/** Skalenende des Balkens — nasse Boeden liegen ueber 100 % nFK. */
const SCALE = 120;

/**
 * Bodenfeuchte der naechsten DWD-Station, taeglich per Action aktualisiert.
 * Fehlt oder bricht die Datei, rendert die Komponente nichts — die Karte
 * funktioniert ohne diesen Block.
 */
export function Bodenfeuchte() {
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

  if (!data) return null;
  const { aktuell, referenz, referenz_zeitraum, trockenere_vergleichstage } = data.bodenfeuchte;
  const [, month, day] = data.stand.split("-");
  const rekord = trockenere_vergleichstage === 0;
  const startYear = referenz_zeitraum?.split(/[–-]/)[0];

  return (
    <div className="mt-3.5">
      <div className="flex items-baseline justify-between gap-2">
        <p className="label">
          Boden am {day}.{month}.
        </p>
        <p className="text-[0.8rem] font-semibold tabular-nums text-ink">{aktuell}&thinsp;%</p>
      </div>
      <div className="relative mt-1.5 h-2 border border-ink-line bg-cream-dark">
        <div
          className="absolute inset-y-0 left-0 bg-gold-500"
          style={{ width: `${Math.min((aktuell / SCALE) * 100, 100)}%` }}
        />
        {referenz != null && (
          <div
            className="absolute -top-0.5 bottom-[-2px] w-px bg-ink"
            style={{ left: `${Math.min((referenz / SCALE) * 100, 100)}%` }}
          />
        )}
      </div>
      {referenz != null && (
        <p className="mt-1 text-[0.62rem] leading-snug text-ink-muted">
          um diese Zeit sonst {referenz}&thinsp;%
        </p>
      )}
      {rekord && (
        <p className="text-[0.62rem] font-semibold leading-snug text-red-700">
          so trocken wie noch nie{startYear ? ` seit ${startYear}` : ""}
        </p>
      )}
    </div>
  );
}

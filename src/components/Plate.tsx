import { useState } from "react";
import { CaretDown } from "@phosphor-icons/react";
import { Bodenfeuchte } from "./Bodenfeuchte";
import { HEIGHT_MAX, HEIGHT_MIN, HEIGHT_STOPS, rampGradient } from "@/lib/ramp";
import type { Grundkarte } from "./TreeMap";
import type { Ausschnitt, Flaeche, Umwelt, Zelle } from "@/lib/umwelt";

const FILTER_MAX = 40;

const MONATE = [
  "Januar", "Februar", "März", "April", "Mai", "Juni",
  "Juli", "August", "September", "Oktober", "November", "Dezember",
];

/** „2026-09-21" zu „21. September". */
export function alsDatum(iso: string): string {
  const [, monat, tag] = iso.split("-");
  return `${Number(tag)}. ${MONATE[Number(monat) - 1] ?? ""}`;
}

/**
 * Das Instrument zur Karte. Ab lg eine angedockte Leiste links unter dem Band,
 * darunter ein Blatt von unten, das in Ruhe genau die Hoehenskala und den
 * Mindesthoehen-Regler zeigt (Formsprache-Probe, Punkt 4).
 */
export function Plate({
  minHeight,
  onMinHeightChange,
  umwelt,
  zellen,
  tageWasser,
  ausschnitt,
  tagIndex,
  onTagChange,
  flaeche,
  onFlaecheChange,
  grundkarte,
  aufgezogen,
  onAufgezogen,
}: {
  minHeight: number;
  onMinHeightChange: (v: number) => void;
  umwelt: Umwelt | null;
  zellen: Zelle[];
  tageWasser: string[];
  ausschnitt: Ausschnitt | null;
  tagIndex: number;
  onTagChange: (i: number) => void;
  flaeche: Flaeche;
  onFlaecheChange: (f: Flaeche) => void;
  grundkarte: Grundkarte;
  aufgezogen: boolean;
  onAufgezogen: (a: boolean) => void;
}) {
  // Die Erlaeuterung klappt innerhalb des Blatts auf. Weil das Blatt in
  // beiden Zustaenden eine feste Hoehe hat und selbst scrollt, verschiebt das
  // nichts, was darueber steht.
  const [notesOpen, setNotesOpen] = useState(false);
  const filtered = minHeight > HEIGHT_MIN;
  // Belegt, dass der Tageslauf laeuft, auch wenn die Quellen nachhinken
  const abruf = umwelt?.abgerufen;
  const maskPercent = ((minHeight - HEIGHT_MIN) / (HEIGHT_MAX - HEIGHT_MIN)) * 100;

  return (
    <section className="plate-scroll absolute inset-x-0 bottom-0 z-20 h-[var(--blatt-hoehe)] overflow-y-auto rounded-t-xl border-t border-ink-frame bg-cream px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] shadow-[0_-4px_18px_rgb(0_0_0/0.08)] lg:static lg:z-auto lg:h-auto lg:w-[25rem] lg:shrink-0 lg:rounded-none lg:border-t-0 lg:border-r lg:border-ink-frame lg:px-5 lg:pt-4 lg:pb-5 lg:shadow-none">
      <button
        type="button"
        aria-expanded={aufgezogen}
        onClick={() => onAufgezogen(!aufgezogen)}
        className="sticky top-0 -mx-4 flex w-[calc(100%+2rem)] justify-center bg-cream pt-2 pb-3 lg:hidden"
      >
        <span aria-hidden className="h-1 w-9 rounded-full bg-ink-frame" />
        <span className="sr-only">{aufgezogen ? "Blatt schließen" : "Blatt aufziehen"}</span>
      </button>

      <p className="mess-label">Baumhöhe in Meter</p>
      <div
        className="relative mt-1.5 h-2 border border-ink-line"
        style={{ background: rampGradient }}
        role="img"
        aria-label={`Farbskala von ${HEIGHT_MIN} bis ${HEIGHT_MAX} Meter Baumhöhe`}
      >
        {filtered && (
          <div
            className="absolute inset-y-0 left-0 bg-cream/85"
            style={{ width: `${maskPercent}%` }}
          />
        )}
      </div>
      <div className="mt-1 flex justify-between text-[12px] tabular-nums lining-nums text-ink-muted">
        {HEIGHT_STOPS.map(([h]) => (
          <span key={h}>{h}</span>
        ))}
      </div>

      <div className="mt-3.5 flex items-baseline justify-between gap-2">
        <label htmlFor="min-height" className="mess-label">
          Mindesthöhe
        </label>
        <span className="text-[13px] font-semibold tabular-nums lining-nums text-ink">
          {filtered ? `ab ${minHeight} m` : "alle Bäume"}
        </span>
      </div>
      <input
        id="min-height"
        type="range"
        className="rule-slider mt-1"
        min={HEIGHT_MIN}
        max={FILTER_MAX}
        step={1}
        value={minHeight}
        onChange={(e) => onMinHeightChange(Number(e.target.value))}
      />

      <Bodenfeuchte
        umwelt={umwelt}
        zellen={zellen}
        tageWasser={tageWasser}
        ausschnitt={ausschnitt}
        tagIndex={tagIndex}
        onTagChange={onTagChange}
        flaeche={flaeche}
        onFlaecheChange={onFlaecheChange}
      />

      <hr className="mt-3 border-ink-line" />

      <button
        onClick={() => setNotesOpen(!notesOpen)}
        aria-expanded={notesOpen}
        className="flex w-full items-center justify-between gap-2 pt-2.5 text-left text-[13px] font-semibold text-ink-soft hover:text-ink"
      >
        Woher die Daten kommen
        <CaretDown size={14} aria-hidden className={notesOpen ? "rotate-180" : ""} />
      </button>

      {notesOpen && (
        <div className="mt-2 space-y-2 text-[13px] leading-relaxed text-ink-soft">
          <p>
            Jeder Punkt ist ein Baum. Die Farbe steht für seine Höhe, Antippen
            zeigt die Zahlen.
          </p>
          <p>
            Die Standorte kommen aus dem Datensatz{" "}
            <a
              href="https://geodaten.bayern.de/opengeodata/OpenDataDetail.html?pn=einzelbaeume"
              target="_blank"
              rel="noreferrer"
              className="font-semibold text-red-700 underline decoration-ink-line underline-offset-2 hover:decoration-red-700"
            >
              Einzelbäume
            </a>{" "}
            der Bayerischen Vermessungsverwaltung, Projektgebiet 124018.
            Ermittelt werden sie bei einer Befliegung, aus Luftbildern und dem
            Oberflächenmodell. Deshalb kennt die Karte Standort und Höhe, aber
            keine Baumarten. Bäume unter 5&thinsp;m fehlen, und in dichten
            Wäldern zählt die Auswertung Kronen, nicht Stämme.
          </p>
          <p>
            Weit herausgezoomt bleibt je Rasterzelle nur der höchste Baum
            stehen. Wer hineinzoomt, sieht alle.
          </p>
          <p>
            Die Dürreklasse stammt aus dem UFZ-Dürremonitor und wird über die
            4-km-Zellen im sichtbaren Ausschnitt gemittelt. Sie beschreibt den
            Gesamtboden als Rang gegenüber den Jahren 1974 bis 2023.
            „Schwere Dürre" heißt also: So trocken ist es hier statistisch nur
            alle zehn Jahre. Das Bodenwasser daneben misst der Deutsche
            Wetterdienst an der nächsten Station. Es gibt an, wie viel von dem
            für Pflanzen verfügbaren Wasser noch da ist.
          </p>
          <p>
            Unter „Fläche" lassen sich zwei Ansichten desselben Bodenwassers
            auf die Karte legen. Die Dürre zeigt, wie ungewöhnlich der Zustand
            ist, das Wasser zeigt, wie viel tatsächlich da ist, in Prozent der
            nutzbaren Feldkapazität für die obersten 25&thinsp;cm. Bei
            40&thinsp;% finden Pflanzen noch gut Wasser, unter 10&thinsp;% wird
            es eng. Immer nur eine Fläche zur Zeit, sonst mischen sich die
            Farben.
          </p>
          <p>
            Die Karos sind 4&thinsp;km groß. So grob ist das Raster, und das
            soll man sehen: Innerhalb eines Karos steht überall derselbe Wert.
            Beide Werte beschreiben die Lage in der Gegend, nicht den Zustand
            eines einzelnen Baums.
          </p>
        </div>
      )}

      {abruf && (
        <p className="mt-2.5 text-[12px] leading-snug text-ink-muted">
          Täglich abgerufen, zuletzt am {alsDatum(abruf)}. Der Stand der
          Quellen liegt ein bis zwei Tage zurück.
        </p>
      )}
      <p className="mt-1 text-[12px] leading-snug text-ink-muted">
        Bäume: Bayerische Vermessungsverwaltung (CC&nbsp;BY&nbsp;4.0) · Karte:{" "}
        {grundkarte === "basemap" ? "basemap.de / BKG" : "TopPlusOpen / BKG"} ·
        Dürre: UFZ-Dürremonitor / Helmholtz-Zentrum&nbsp;für&nbsp;Umweltforschung ·
        Bodenwasser: DWD
      </p>
    </section>
  );
}

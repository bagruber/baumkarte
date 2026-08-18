import { useState } from "react";
import { Bodenfeuchte } from "./Bodenfeuchte";
import { HEIGHT_MAX, HEIGHT_MIN, HEIGHT_STOPS, rampGradient } from "@/lib/ramp";
import type { Ausschnitt, Umwelt, Zelle } from "@/lib/umwelt";

const TREE_COUNT = 2_868_813;
const FILTER_MAX = 40;

/** Randblock des Kartenblatts: Titel, Hoehenskala, Regler, Quellenvermerk. */
export function Plate({
  minHeight,
  onMinHeightChange,
  umwelt,
  zellen,
  ausschnitt,
  tagIndex,
  onTagChange,
  showDuerre,
  onToggleDuerre,
}: {
  minHeight: number;
  onMinHeightChange: (v: number) => void;
  umwelt: Umwelt | null;
  zellen: Zelle[];
  ausschnitt: Ausschnitt | null;
  tagIndex: number;
  onTagChange: (i: number) => void;
  showDuerre: boolean;
  onToggleDuerre: (v: boolean) => void;
}) {
  // Mobil hat die Platte eine feste Hoehe statt mitzuwachsen: So verschiebt
  // das Ausklappen der Erlaeuterung nichts, was darueber steht — der Block
  // ist ohnehin scrollbar. Am Desktop haengt sie oben und waechst nach unten.
  const [notesOpen, setNotesOpen] = useState(false);
  const filtered = minHeight > HEIGHT_MIN;
  const maskPercent = ((minHeight - HEIGHT_MIN) / (HEIGHT_MAX - HEIGHT_MIN)) * 100;

  return (
    <section className="plate-scroll absolute inset-x-0 bottom-0 z-10 h-[52dvh] overflow-y-auto rounded-t-sm border-t border-ink-frame bg-cream px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] shadow-[0_-2px_12px_rgb(0_0_0/0.07)] sm:inset-x-auto sm:bottom-auto sm:left-4 sm:top-4 sm:h-auto sm:max-h-[calc(100dvh-2rem)] sm:w-[19.5rem] sm:rounded-sm sm:border sm:px-4 sm:pt-4 sm:pb-4 sm:shadow-soft">
      <p className="eyebrow text-red-700">Moosburg an der Isar bis Landshut</p>
      <h1 className="headline mt-1 text-[1.35rem] sm:text-[1.5rem]">Baumkarte</h1>
      <p className="mt-1.5 mb-3 text-[0.75rem] tabular-nums text-ink-soft">
        {TREE_COUNT.toLocaleString("de-DE")} Einzelbäume
      </p>

      {/* Goldregel als Blattkante — greift die Blattschnitt-Linie der Karte auf */}
      <div className="-mx-4 h-[2px] bg-gold-500" />

      <p className="label mt-3">Baumhöhe in Meter</p>
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
      <div className="mt-1 flex justify-between text-[0.62rem] tabular-nums text-ink-muted">
        {HEIGHT_STOPS.map(([h]) => (
          <span key={h}>{h}</span>
        ))}
      </div>

      <div className="mt-3.5 flex items-baseline justify-between gap-2">
        <label htmlFor="min-height" className="label">
          Mindesthöhe
        </label>
        <span className="text-[0.8rem] font-semibold tabular-nums text-ink">
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
        ausschnitt={ausschnitt}
        tagIndex={tagIndex}
        onTagChange={onTagChange}
        showLayer={showDuerre}
        onToggleLayer={onToggleDuerre}
      />

      <hr className="mt-3 border-ink-line" />

      <button
        onClick={() => setNotesOpen(!notesOpen)}
        aria-expanded={notesOpen}
        className="flex w-full items-center justify-between gap-2 pt-2.5 text-left text-[0.72rem] font-semibold text-ink-soft hover:text-ink"
      >
        Woher die Daten kommen
        <svg
          width="9"
          height="6"
          viewBox="0 0 9 6"
          fill="none"
          aria-hidden
          className={notesOpen ? "rotate-180" : ""}
        >
          <path
            d="M1 1.5 4.5 5 8 1.5"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {notesOpen && (
        <div className="mt-2 space-y-2 text-[0.75rem] leading-relaxed text-ink-soft">
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
            Beide Werte beschreiben die Lage in der Gegend, nicht den Zustand
            eines einzelnen Baums.
          </p>
          <p className="text-[0.7rem] text-ink-muted">
            Private Eigenentwicklung, kein Angebot der Stadt. Kein Tracking.{" "}
            <a
              href="https://github.com/bagruber/baumkarte/issues"
              target="_blank"
              rel="noreferrer"
              className="font-semibold text-red-700 underline decoration-ink-line underline-offset-2 hover:decoration-red-700"
            >
              Feedback
            </a>
          </p>
        </div>
      )}

      <p className="mt-2.5 text-[0.62rem] leading-snug text-ink-muted">
        Bäume: Bayerische Vermessungsverwaltung (CC&nbsp;BY&nbsp;4.0) · Karte:
        basemap.de / BKG · Dürre: UFZ-Dürremonitor /
        Helmholtz-Zentrum&nbsp;für&nbsp;Umweltforschung · Bodenwasser: DWD
      </p>
    </section>
  );
}

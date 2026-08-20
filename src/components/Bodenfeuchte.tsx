import {
  KLASSEN,
  WASSER_STUFEN,
  mittelImAusschnitt,
  smiKlasse,
  wasserStufe,
  type Ausschnitt,
  type Flaeche,
  type Umwelt,
  type Zelle,
} from "@/lib/umwelt";

/**
 * Wie weit liegt ein Datum zurueck?
 *
 * Der Zeitstrahl endet nicht heute. UFZ und DWD brauchen ein bis zwei Tage,
 * bis ein Tag durchgerechnet und veroeffentlicht ist. Frueher stand am rechten
 * Anschlag "neuester Tag", was sich wie "heute" las.
 */
function abstandZuHeute(iso: string): string {
  // Mittag als Anker: Sonst kippt der Abstand je nach Uhrzeit um einen Tag
  const tage = Math.round((Date.now() - Date.parse(`${iso}T12:00:00`)) / 86_400_000);
  if (tage <= 0) return "heute";
  if (tage === 1) return "gestern";
  return `vor ${tage} Tagen`;
}

const WAHL: { wert: Flaeche; text: string }[] = [
  { wert: "aus", text: "aus" },
  { wert: "duerre", text: "Dürre" },
  { wert: "wasser", text: "Wasser" },
];

/**
 * Bodenzustand im sichtbaren Kartenausschnitt.
 *
 * Zwei Sichten auf dasselbe Bodenwasser: die Duerreklasse als Rang gegenueber
 * 1974-2023 und das pflanzenverfuegbare Wasser als absoluter Wert. Es liegt
 * immer nur eine davon als Flaeche auf der Karte, sonst mischen sich die
 * Farben zu Matsch.
 */
export function Bodenfeuchte({
  umwelt,
  zellen,
  tageWasser,
  ausschnitt,
  tagIndex,
  onTagChange,
  flaeche,
  onFlaecheChange,
}: {
  umwelt: Umwelt | null;
  zellen: Zelle[];
  tageWasser: string[];
  ausschnitt: Ausschnitt | null;
  tagIndex: number;
  onTagChange: (i: number) => void;
  flaeche: Flaeche;
  onFlaecheChange: (f: Flaeche) => void;
}) {
  if (!umwelt?.duerre) return null;
  const { serie } = umwelt.duerre;
  const index = Math.min(tagIndex, serie.length - 1);
  const zeigtWasser = flaeche === "wasser";

  // Was man sieht, zaehlt. Sind die Zellen noch nicht geladen, greift das
  // Gebietsmittel aus der Tagesdatei.
  const sicht = mittelImAusschnitt(zellen, ausschnitt, index, zeigtWasser ? "wasser" : "werte");
  const smiTag = serie[index];
  const wasserTag = umwelt.wasser?.serie[Math.min(index, umwelt.wasser.serie.length - 1)];

  const stufen = zeigtWasser ? WASSER_STUFEN.map((s) => ({ name: s.name, farbe: s.farbe })) : KLASSEN;
  const aktiv = zeigtWasser
    ? wasserStufe(sicht ? sicht.wert : (wasserTag?.nfk ?? 0))
    : KLASSEN.findIndex(
        (k) => k.name === (sicht ? smiKlasse(sicht.wert).name : smiTag.klasse),
      );

  // Beide Quellen haben eigene Zeitachsen: Die nFK-Datei reicht meist
  // ein bis zwei Tage weiter als der Duerreindex.
  const stand = zeigtWasser ? (tageWasser[index] ?? wasserTag?.stand ?? "") : smiTag.stand;
  const [, month, day] = stand.split("-");
  const istLetzterTag = index >= serie.length - 1;

  const klasse = sicht ? smiKlasse(sicht.wert) : { name: smiTag.klasse, wiederkehr: smiTag.wiederkehr_jahre };
  const wasserWert = zeigtWasser && sicht ? sicht.wert : wasserTag?.nfk;

  return (
    <div className="mt-3.5">
      <div className="flex items-baseline justify-between gap-2">
        <p className="label">{zeigtWasser ? "Wasser im Boden" : "Boden im Ausschnitt"}</p>
        {day && (
          <p className="text-[0.62rem] tabular-nums text-ink-muted">
            {day}.{month}.
          </p>
        )}
      </div>

      {/* Statusanzeige und zugleich Legende der Kartenfläche */}
      <div className="mt-1.5 flex gap-px" role="img" aria-label={stufen[aktiv]?.name ?? ""}>
        {stufen.map((s, i) => (
          <div
            key={s.name}
            title={s.name}
            className="h-2 flex-1"
            style={{
              background: flaeche !== "aus" || i <= aktiv ? s.farbe : "var(--color-cream-dark)",
              opacity: flaeche !== "aus" && i !== aktiv ? 0.45 : 1,
              outline: i === aktiv ? "1px solid var(--color-ink)" : undefined,
            }}
          />
        ))}
      </div>
      {/* Immer gerendert, damit der Schalter beim Umlegen nicht wandert */}
      <div className="mt-0.5 flex justify-between text-[0.55rem] uppercase tracking-[0.1em] text-ink-muted">
        <span>{zeigtWasser ? "trocken" : "mild"}</span>
        <span>{sicht ? `${sicht.zellen} ${sicht.zellen === 1 ? "Karo" : "Karos"}` : "4-km-Raster"}</span>
        <span>{zeigtWasser ? "feucht" : "schwer"}</span>
      </div>

      {/* Feste Mindesthöhe: Der Dürretext braucht zwei Zeilen, der Wassertext
          eine. Ohne sie wandert die Flächenauswahl beim Umschalten. */}
      <div className="mt-1 min-h-[2.7rem]">
        {zeigtWasser ? (
          <>
            <p className="text-[0.7rem] font-semibold leading-snug text-red-700">
              {wasserWert != null
                ? `${wasserWert.toFixed(0)} % nutzbare Feldkapazität`
                : "keine Daten"}
            </p>
            <p className="text-[0.62rem] leading-snug text-ink-muted">
              pflanzenverfügbares Wasser, oberste 25&thinsp;cm
            </p>
          </>
        ) : (
          <>
            <p className="text-[0.7rem] font-semibold leading-snug text-red-700">{klasse.name}</p>
            <p className="text-[0.62rem] leading-snug text-ink-muted">
              {klasse.wiederkehr ? `sonst nur alle ${klasse.wiederkehr} Jahre so trocken` : ""}
              {istLetzterTag && (
                <>
                  {klasse.wiederkehr ? ", " : ""}Bodenwasser {umwelt.bodenfeuchte.aktuell}&thinsp;%
                  {umwelt.bodenfeuchte.referenz != null
                    ? ` statt ${umwelt.bodenfeuchte.referenz} %`
                    : ""}
                </>
              )}
            </p>
          </>
        )}
      </div>

      <div className="mt-2 flex items-baseline justify-between gap-2">
        <label htmlFor="duerre-tag" className="label">
          Zeitraum
        </label>
        <span className="text-[0.62rem] tabular-nums text-ink-muted">
          {stand ? abstandZuHeute(stand) : ""}
        </span>
      </div>
      <input
        id="duerre-tag"
        type="range"
        className="rule-slider rule-slider--duerre mt-0.5"
        min={0}
        max={serie.length - 1}
        step={1}
        value={index}
        onChange={(e) => onTagChange(Number(e.target.value))}
      />

      <div className="mt-2 flex items-center gap-2">
        <span className="label">Fläche</span>
        <div className="flex flex-1 overflow-hidden rounded-sm border border-ink-line">
          {WAHL.map((w) => (
            <button
              key={w.wert}
              onClick={() => onFlaecheChange(w.wert)}
              aria-pressed={flaeche === w.wert}
              className={`flex-1 px-1 py-0.5 text-[0.68rem] font-semibold transition-colors ${
                flaeche === w.wert
                  ? "bg-ink text-cream"
                  : "bg-cream text-ink-soft hover:bg-cream-dark hover:text-ink"
              }`}
            >
              {w.text}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

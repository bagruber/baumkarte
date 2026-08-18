import {
  KLASSEN,
  mittelImAusschnitt,
  smiKlasse,
  type Ausschnitt,
  type Umwelt,
  type Zelle,
} from "@/lib/umwelt";

/**
 * Duerrelage im sichtbaren Kartenausschnitt.
 *
 * Der Zeitstrahl steuert Statuszeile und Kartenebene gemeinsam. Er haengt
 * nicht am Flaechen-Schalter, damit beim Umschalten nichts springt.
 */
export function Bodenfeuchte({
  umwelt,
  zellen,
  ausschnitt,
  tagIndex,
  onTagChange,
  showLayer,
  onToggleLayer,
}: {
  umwelt: Umwelt | null;
  zellen: Zelle[];
  ausschnitt: Ausschnitt | null;
  tagIndex: number;
  onTagChange: (i: number) => void;
  showLayer: boolean;
  onToggleLayer: (v: boolean) => void;
}) {
  if (!umwelt?.duerre) return null;
  const { serie } = umwelt.duerre;
  const index = Math.min(tagIndex, serie.length - 1);
  const tag = serie[index];

  // Was man sieht, zaehlt. Erst wenn die Zellen noch nicht geladen sind,
  // greift das Gebietsmittel aus der Tagesdatei.
  const sicht = mittelImAusschnitt(zellen, ausschnitt, index);
  const klasse = sicht ? smiKlasse(sicht.smi) : { name: tag.klasse, wiederkehr: tag.wiederkehr_jahre };

  const { aktuell, referenz } = umwelt.bodenfeuchte;
  const aktiv = KLASSEN.findIndex((k) => k.name === klasse.name);
  const [, month, day] = tag.stand.split("-");
  const istHeute = index >= serie.length - 1;

  return (
    <div className="mt-3.5">
      <div className="flex items-baseline justify-between gap-2">
        <p className="label">Boden im Ausschnitt</p>
        <p className="text-[0.62rem] tabular-nums text-ink-muted">
          {day}.{month}.
        </p>
      </div>

      {/* Statusanzeige und zugleich Legende der Kartenfläche */}
      <div className="mt-1.5 flex gap-px" role="img" aria-label={`Dürreklasse: ${klasse.name}`}>
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
      {/* Immer gerendert, damit der Schalter beim Umlegen nicht wandert */}
      <div className="mt-0.5 flex justify-between text-[0.55rem] uppercase tracking-[0.1em] text-ink-muted">
        <span>mild</span>
        <span>{sicht ? `${sicht.zellen} ${sicht.zellen === 1 ? "Karo" : "Karos"}` : "4-km-Raster"}</span>
        <span>schwer</span>
      </div>

      <p className="mt-1 text-[0.7rem] font-semibold leading-snug text-red-700">{klasse.name}</p>
      <p className="text-[0.62rem] leading-snug text-ink-muted">
        {klasse.wiederkehr ? `sonst nur alle ${klasse.wiederkehr} Jahre so trocken` : ""}
        {istHeute && (
          <>
            {klasse.wiederkehr ? ", " : ""}Bodenwasser {aktuell}&thinsp;%
            {referenz != null ? ` statt ${referenz} %` : ""}
          </>
        )}
      </p>

      <div className="mt-2 flex items-baseline justify-between gap-2">
        <label htmlFor="duerre-tag" className="label">
          Zeitraum
        </label>
        <span className="text-[0.62rem] tabular-nums text-ink-muted">
          {istHeute ? "neuester Tag" : `vor ${serie.length - 1 - index} Tagen`}
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

      <label className="mt-1 flex cursor-pointer items-center gap-2 text-[0.7rem] font-semibold text-ink-soft hover:text-ink">
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

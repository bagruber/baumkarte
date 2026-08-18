import { KLASSEN, type Umwelt } from "@/lib/umwelt";

/**
 * Duerrelage im Kartengebiet. Der Zeitstrahl steuert Statuszeile und
 * Kartenebene gemeinsam — deshalb ist er immer sichtbar und nicht an den
 * Flaechen-Schalter gekoppelt: So springt beim Umschalten nichts.
 */
export function Bodenfeuchte({
  umwelt,
  tagIndex,
  onTagChange,
  showLayer,
  onToggleLayer,
}: {
  umwelt: Umwelt | null;
  tagIndex: number;
  onTagChange: (i: number) => void;
  showLayer: boolean;
  onToggleLayer: (v: boolean) => void;
}) {
  if (!umwelt?.duerre) return null;
  const { serie } = umwelt.duerre;
  const tag = serie[Math.min(tagIndex, serie.length - 1)];
  const { aktuell, referenz } = umwelt.bodenfeuchte;
  const aktiv = KLASSEN.findIndex((k) => k.name === tag.klasse);
  const [, month, day] = tag.stand.split("-");
  const istHeute = tagIndex >= serie.length - 1;

  return (
    <div className="mt-3.5">
      <div className="flex items-baseline justify-between gap-2">
        <p className="label">Boden im Gebiet</p>
        <p className="text-[0.62rem] tabular-nums text-ink-muted">
          {day}.{month}.
        </p>
      </div>

      {/* Statusanzeige und zugleich Legende der Kartenfläche */}
      <div className="mt-1.5 flex gap-px" role="img" aria-label={`Dürreklasse: ${tag.klasse}`}>
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
        <span>4-km-Raster</span>
        <span>schwer</span>
      </div>

      <p className="mt-1 text-[0.7rem] font-semibold leading-snug text-red-700">{tag.klasse}</p>
      <p className="text-[0.62rem] leading-snug text-ink-muted">
        {tag.wiederkehr_jahre ? `sonst nur alle ${tag.wiederkehr_jahre} Jahre so trocken` : ""}
        {istHeute && (
          <>
            {tag.wiederkehr_jahre ? ", " : ""}Bodenwasser {aktuell}&thinsp;%
            {referenz != null ? ` statt ${referenz} %` : ""}
          </>
        )}
      </p>

      <div className="mt-2 flex items-baseline justify-between gap-2">
        <label htmlFor="duerre-tag" className="label">
          Zeitraum
        </label>
        <span className="text-[0.62rem] tabular-nums text-ink-muted">
          {istHeute ? "neuester Tag" : `vor ${serie.length - 1 - tagIndex} Tagen`}
        </span>
      </div>
      <input
        id="duerre-tag"
        type="range"
        className="rule-slider rule-slider--duerre mt-0.5"
        min={0}
        max={serie.length - 1}
        step={1}
        value={Math.min(tagIndex, serie.length - 1)}
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

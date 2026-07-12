export function InfoPanel({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="absolute inset-0 z-20 flex items-end justify-center bg-ink/30 sm:items-center"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="info-title"
        className="max-h-[85dvh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-ink-line bg-cream p-5 shadow-lift sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-start justify-between gap-4">
          <h2 id="info-title" className="headline text-xl">
            Über diese Karte
          </h2>
          <button
            onClick={onClose}
            aria-label="Schließen"
            className="rounded-md px-2 py-1 text-ink-soft hover:bg-cream-dark hover:text-ink"
          >
            ✕
          </button>
        </div>

        <div className="space-y-3 text-[0.92rem] leading-relaxed text-ink-soft">
          <p>
            Diese Karte zeigt <strong className="text-ink">2.868.813 Einzelbäume</strong> zwischen
            Moosburg an der Isar und Landshut — jeder Punkt ein Baum, gefärbt
            nach seiner Höhe. Antippen zeigt Baumhöhe und Geländehöhe.
          </p>
          <p>
            Die Baumstandorte stammen aus dem Datensatz{" "}
            <a
              href="https://geodaten.bayern.de/opengeodata/OpenDataDetail.html?pn=einzelbaeume"
              target="_blank"
              rel="noreferrer"
              className="font-semibold text-red-700 underline decoration-ink-line underline-offset-2 hover:decoration-red-700"
            >
              Einzelbäume
            </a>{" "}
            der Bayerischen Vermessungsverwaltung (Projektgebiet 124018). Sie
            werden automatisch aus dem Oberflächenmodell und Luftbildern
            abgeleitet — deshalb gibt es Standort und Höhe, aber keine
            Baumarten. Kleinere Bäume unter etwa 5&thinsp;m sind nicht
            enthalten, und in dichten Wäldern zählt die Auswertung
            Baumkronen, nicht Stämme.
          </p>
          <p>
            In niedrigen Zoomstufen wird ausgedünnt dargestellt: pro
            Rasterzelle bleibt der höchste Baum sichtbar. Erst beim
            Hineinzoomen erscheinen alle Bäume.
          </p>
          <p className="rounded-lg bg-cream-dark px-3 py-2 text-[0.8rem]">
            Private Eigenentwicklung, kein offizielles Angebot einer Behörde.
            Datenquelle: Bayerische Vermessungsverwaltung (CC&nbsp;BY&nbsp;4.0),
            Basiskarte: basemap.de / BKG. Kein Tracking, keine Cookies.
            Feedback gerne als{" "}
            <a
              href="https://github.com/bagruber/baumkarte/issues"
              target="_blank"
              rel="noreferrer"
              className="font-semibold text-red-700 underline decoration-ink-line underline-offset-2 hover:decoration-red-700"
            >
              GitHub-Issue
            </a>
            .
          </p>
        </div>
      </div>
    </div>
  );
}

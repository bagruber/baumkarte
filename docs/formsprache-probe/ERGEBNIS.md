# Formsprache in der Baumkarte: Ergebnis der Probe

*Stand 28.09.2026. Gebaut auf `probe/formsprache`, **nicht gemergt und nicht
gepusht**. Die Entscheidungen sind **vorläufig**: Kanon ist allein
`../moosburg-design/css/theme.css`, das Protokoll dort führt den Verlauf.*

Grundlage: `../moosburg-design/docs/formsprache/briefing-karten.md` (AP 0 bis 10) und
die Vorlage [Karten, erste Lesung](https://claude.ai/artifact/P9KpGjEkzRw94DcB2hZ8Rw),
Version 3. Vorher- und Nachher-Aufnahmen bei 390 × 844 und 1440 × 900 liegen lokal
unter `vorher/` und `nachher/` (per `.git/info/exclude` ausgenommen), aufgenommen
unter `/data/baumkarte/`.

## Was jetzt gilt

| Bereich | Umsetzung | Commit |
|---|---|---|
| Kanon und Pakete | `moosburg-design` von 0.1.0 auf 0.3.0, damit `--color-thema-*` da ist. Phosphor aufgenommen, alle Ranges auf die Hausbasis gezogen (react, tailwind und die Typen standen noch auf `^19.0.0` beziehungsweise `^4.0.0`). Vitest eingerichtet wie im foodhub. | `ed89c4d` |
| Schrift | `.headline`, `.eyebrow` und `.label` gelöscht. Beschriftungen an Instrumenten als `.mess-label`: Satzschreibung, 13 px, halbfett, `ink-soft`. Kein Versal mehr in der App. | `ad5a262` |
| Kleinster Lesegrad | 12 px überall, wo gelesen wird. Vorher 0,55 bis 0,72 rem, also 8,8 bis 11,5 px: Skalenziffern, Legendenzeile, Dürretext, Quellenvermerk, Popup. | `ad5a262` |
| Datum | „8. September" statt „08.09.", Zahlen mit `tabular-nums lining-nums`. | `ad5a262` |
| Kopfband | Stripe 4 px, darunter das Band in Tannengrün. Desktop 52 px mit Rücklink „Data Hub", Trennlinie, Titel 23 px, Kennzahl, Rosen-Knopf. Telefon 60 px mit Pfeil 44 × 44, zweizeilig Titel und Kennzahl, Rosen-Knopf 44 × 44. Kicker „Moosburg an der Isar" entfallen. | `ad5a262` |
| Panel | `UeberDasProjekt` aus dem Data Hub übernommen: Disclosure, `aria-expanded`, Esc und Klick außerhalb schließen, Fokus zurück. Ab `lg` unter dem Knopf, darunter Blatt von unten. „Kein Tracking" steht jetzt dort. | `ad5a262` |
| Seitenleiste | Ab `lg` 400 px links unter dem Band, Creme, Haarlinie rechts, eigener Scrollbereich. `fitBounds` ohne asymmetrisches Polster, die Karte füllt den Rest. | `ad5a262` |
| Blatt am Telefon | Von unten, 8 px gerundet, Griff 36 × 4 als Knopf mit `aria-expanded`. In Ruhe 10 rem: Höhenskala und Mindesthöhe. Aufgezogen 62 dvh: Boden, Zeitraum, Fläche, Erläuterung, Quellen. | `ad5a262` |
| Zeiger | `--zeiger: var(--color-thema-tannengruen)` in `src/index.css`. Beide Schieber nehmen ihn, `.rule-slider--duerre` ist damit überflüssig und entfallen. | `ad5a262` |
| Umschalter „Fläche" | Helle Schiene: Grund `cream-dark`, 2 px Innenabstand, gewähltes Feld weiß mit leichtem Schatten und halbfett. Vorher Tinte mit Creme-Schrift. | `ad5a262` |
| Grundkarte | `papierton()` multipliziert jede Farbangabe in `layers[].paint` kanalweise mit Creme, Ausdrücke eingeschlossen. Neun Tests. | `ad5a262`, `5a05320` |
| Rückfall | Graue TopPlusOpen statt der bunten OSM-Kacheln. Der Quellenvermerk nennt, was geladen wurde. | `ad5a262` |
| Kartenknöpfe | Eigene Gruppe oben rechts mit Phosphor `Plus`, `Minus`, `Crosshair`, Creme, Haarlinie, 4 px. Nur bei `(hover: hover) and (pointer: fine)`. Am Telefon stattdessen ein Standort-Knopf 42 × 42 unten rechts, 12 px über dem Blatt, der mit dessen Höhe wandert. | `ad5a262` |
| Meterstab | Vier Felder im Wechsel Tinte und Creme, 5 px hoch, Rahmen 1 px Tinte, außen 1 px Creme als Hof. Darüber „0" links und die Strecke rechts, 12 px `ink-soft` mit Creme-Hof. Ab `lg` unten links, darunter oben links. | `ad5a262` |
| Laden | Drei Kacheln 64 × 64 mit Rosen auf der Kartenfläche, mittlere in Tannengrün, `rose-tile-pulse`, darunter „Karte wird geladen" 14 px. Verschwindet beim ersten `idle`, erst dann erscheint die Kennzahl. | `ad5a262` |
| Popup | 4 px Ecken, Beschriftung in Satzschreibung 12 px. Regel: bis zwei Werte ein Zettel am Punkt. | `ad5a262` |

## Die beiden Ersatzvarianten

Beide sind **Proben**, nicht beschlossen. Wo umgeschaltet wird:

**Punkt 7A, Zeiger in Rot statt in der Themenfarbe.** Eine Zeile in
`src/index.css`, ganz oben im `:root`-Block. Die Ersatzzeile steht als Kommentar
direkt darüber:

```css
:root {
  --zeiger: var(--color-thema-tannengruen);
  /* Ersatz 7A: --zeiger: var(--color-red-700); */
}
```

Mehr ist nicht zu tun, beide Schieber lesen die Variable.

**Punkt 6, gesetzte Filter in Gold.** Betrifft die Baumkarte **nicht**: sie hat
keine Chips und keinen Filterknopf. Ihr einziger Filter ist der
Mindesthöhen-Schieber, und der ist ein Zeiger, kein gesetzter Filter. Die Probe
liegt allein in den Speisekarten, siehe `../foodhub/docs/formsprache-probe/ERGEBNIS.md`.

## Beobachtungen aus AP 4, am gebauten Stand angesehen

**Der Tannengrün-Zeiger neben dem dunkelsten Baumgrün: 1,01:1.** Das ist der Befund,
um den AP 4 gebeten hat, und er fällt deutlich aus. `#1f3b2d` (Tannengrün) und
`#0b3d20` (das dunkle Ende der Höhenrampe) sind nebeneinander nicht zu
unterscheiden. Solange der Schieber links steht, fällt das nicht auf: er sitzt auf
Creme und steht dort mit 11,41:1. Schiebt man ihn nach rechts, steht er rund 50 px
unter dem dunklen Ende der Rampe, und beide lesen sich als derselbe Ton. Die Aufnahme
dazu ist `nachher/zeiger-am-dunklen-ende.png`.

Meine Lesart: Es ist kein Lesbarkeitsproblem, sondern ein Bedeutungsproblem. Der
Zeiger sagt „Bedienung", die Rampe sagt „Daten", und in derselben Farbe sagen beide
dasselbe. In den Historischen Karten und den Speisekarten tritt das nicht auf, dort
liegt keine Datenfarbe in der Nähe der Themenfarbe. **Wenn du 7C behältst, wäre die
Baumkarte der Kandidat für die Ausnahme**, entweder mit dem Ersatz 7A oder indem die
Rampe an ihrem dunklen Ende aufhellt. Rot-700 löst es nicht über die Helligkeit
(1,58:1 gegen `#0b3d20`, auch dunkel), sondern über den Farbton: Rot neben Grün ist
als andere Sache erkennbar, Grün neben Grün nicht.

**Gold-Chips neben den roten Punkten** gibt es in der Baumkarte nicht, siehe oben.

## Messwerte

Kontraste nach WCAG 2.1, gerechnet aus den Tokens:

| Stelle | Wert |
|---|---|
| Creme auf dem Band (Tannengrün) | 11,41:1 |
| Gold-200 auf dem Band (Kennzahl) | 8,41:1 |
| Rücklink, Creme 85 % auf dem Band | 8,73:1 |
| Einheit, Creme 82 % auf dem Band | 8,24:1 |
| `ink-soft` auf Creme (`.mess-label`, Meterstab) | 6,98:1 |
| `ink-muted` auf Creme (12 px, Quellenvermerk) | 4,96:1 |
| Tinte auf Creme (Felder des Meterstabs) | 15,95:1 |
| hellstes Baumgrün `#639436` auf Creme | 3,38:1 |
| Tannengrün-Zeiger auf Creme | 11,41:1 |
| **Tannengrün-Zeiger neben `#0b3d20`** | **1,01:1** |

Layout, gemessen am gebauten Stand:

| Größe | Messwert |
|---|---|
| Seitenleiste ab `lg` | 400 px |
| Titel im Band | 23 px, Source Serif 4 Variable |
| kleinster Schriftgrad im Blatt | 12 px |
| `scrollWidth` / `clientWidth` bei 390 px | 390 / 390 |
| Mindesthöhen-Regler, Blatt in Ruhe | y = 802 |
| Mindesthöhen-Regler, Blatt aufgezogen | y = 503 |
| Mindesthöhen-Regler, aufgezogen mit offener Erläuterung | y = 503, **unverändert** |

Die ruhige Oberfläche gilt also weiter: Innerhalb eines Zustands verschiebt das
Aufklappen der Erläuterung nichts. Zwischen den beiden Zuständen wandert der Regler,
das ist die Bewegung des Blatts selbst.

## Prüfungen

- `pnpm typecheck`, `pnpm build`, `pnpm build:hostinger`, `pnpm test` grün
  (9 Tests, alle für `papierton`).
- `grep -rn "uppercase\|eyebrow\|headline\|\.label\|Inter\|Playfair" src` leer.
- `grep -rnE "text-\[0\.[0-6][0-9]*rem\]|text-\[1[01]px\]|font-size: 0\.[0-6]" src` leer.
- Geladen werden nur `source-serif-4-latin-opsz-normal` und
  `atkinson-hyperlegible-next-latin-wght-normal`.
- Keine Konsolenfehler, keine 404.
- Kein waagrechter Überlauf bei 390 px.
- Tastatur bei 1440: Rücklink, Panel, Höhenregler, Zeitstrahl, drei Umschalter,
  Erläuterung, Karte, drei Kartenknöpfe. Bei 390 zusätzlich der Griff des Blatts an
  dritter Stelle. Panel: `aria-expanded` wechselt, Esc schließt, der Fokus kehrt zum
  Knopf zurück.
- Am Telefon (Playwright mit `isMobile`) keine Zoomknöpfe, nur der Standort-Knopf.
- **Papierton am echten Stil nachgezählt** (bm_web_gry.json, 28.09.2026): 557 Ebenen,
  614 Farbangaben in `layers[].paint`, alle getönt, keine übersehen. Weiß wird exakt
  `#faf7f2`.
- **Rückfall geprüft** mit `page.route` und `abort` auf basemap.de: die Baumkarte lädt
  12 TopPlusOpen-Kacheln und zeigt die graue Karte, der Quellenvermerk nennt
  „TopPlusOpen / BKG". Aufnahme `nachher/rueckfall-topplus.png`.

## Gefundene Fehler und offene Punkte

- **MapLibres Stylesheet stand im Bundle hinter unseren Regeln.** Der Import lag in
  `TreeMap.tsx`, `index.css` kam über `main.tsx` davor, und bei gleicher Spezifität
  gewann MapLibre. Die Trimmung von Maßstab und Kartenknöpfen war deshalb seit jeher
  nur zur Hälfte wirksam: gemessen 10 px Schriftgrad und 5 px Innenabstand statt der
  gesetzten Werte. Der Import steht jetzt in `index.css` vor den eigenen Regeln.
  **Derselbe Fehler lag in allen drei Karten.**
- **basemap.de war am 27.09. den ganzen Tag mit 503 ausgefallen** („ERROR_ALL_SERVER_UNAVAILABLE",
  Antwortzeit 10 s), am 28.09. wieder erreichbar. Die Vorher-Aufnahmen zeigen deshalb
  den alten Rückfall auf bunte OSM-Kacheln.
- **Der Meterstab auf sehr dunklem Grund.** Der Hof in Creme trägt den Balken
  zuverlässig, die Ziffern in `ink-soft` verlieren sich. Geprüft mit künstlich auf
  25 % abgedunkelter Karte (`nachher/meterstab-probe-dunkel.png`), weil der graue
  Rückfall keine dunklen Stellen hat und basemap.de an dem Tag ausfiel. Auf den
  Waldflächen von basemap.de dürfte es reichen, angesehen ist es dort nicht. Wenn es
  nicht reicht, ist der kleinste Griff ein dichterer Hof (mehr Schattenlagen in Creme)
  oder Tinte statt `ink-soft` für die Ziffern.
- **Der Quellenvermerk im eingeklappten Blatt am Telefon.** Er steht außerhalb der
  Erläuterung und ist damit „ohne Aufklappen" sichtbar, wie das Briefing es verlangt,
  aber im eingeklappten Blatt liegt er unterhalb der Kante. Die Tabelle in AP 3 ordnet
  „Quellen" ausdrücklich dem aufgezogenen Zustand zu, deshalb ist es so gebaut. Falls
  die UFZ-Bedingung „direkt an der Karte" strenger zu lesen ist, gehört eine
  einzeilige Quellenzeile an die Unterkante des eingeklappten Blatts; das kostet
  16 px Ruhehöhe.
- **Ein Commit statt acht.** Das Briefing will einen Commit je Arbeitspaket. Die
  Pakete 1 bis 8 teilen sich hier dieselben Dateien: `index.css` trägt Schrift,
  Zeiger, Kartenknöpfe, Meterstab und Ladeformen zugleich, und `App`, `Plate` und
  `TreeMap` hängen über Kopf, Blatthöhe und Grundkarte aneinander. Getrennte Commits
  wären Schnitte mitten durch eine Datei gewesen, mit Zwischenständen, die nicht
  bauen. Gleiches gilt für die beiden anderen Karten.
- **`papierton` behandelt nicht alle sechs Schreibweisen.** Das Briefing nennt sechs
  und sagt, im Stil nachzusehen und nur die vorkommenden zu bauen. Am 27.09. war
  basemap.de nicht erreichbar, deshalb stand zuerst die volle Fassung samt
  `hsl()`-Umrechnung. Am 28.09. nachgezählt: ausschließlich `rgb()`. Die Funktion ist
  daraufhin auf `rgb()`, `rgba()` und Hex gekürzt (`5a05320`), `hsl()` ist draußen.
  Hex bleibt, weil es die übliche zweite Schreibweise in MapLibre-Stilen ist und sechs
  Zeilen kostet.
- **Zwei Karteninstanzen laufen nicht hier, sondern im foodhub** (dort notiert).

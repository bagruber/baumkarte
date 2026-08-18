# Baumkarte — Projektkontext

*Lebendes Arbeitsdokument. Vollständig lesen, bevor Code geschrieben wird.
Änderungen mit Datum vermerken. Stand: 12.07.2026*

---

## 0. Arbeitsweise (Karpathy-Prinzipien)

Nicht verhandelbar, gelten für jede Änderung:

1. **Think Before Coding** — Annahmen explizit machen. Bei Mehrdeutigkeit
   Alternativen zeigen und nachfragen, nicht raten.
2. **Simplicity First** — Einfachste lauffähige Lösung. Keine spekulativen
   Features, keine Abstraktionen für Einmal-Nutzung.
3. **Surgical Changes** — Nur ändern, was die Aufgabe verlangt. Bestehenden
   Stil matchen, nicht „nebenbei verbessern".
4. **Goal-Driven Execution** — Vage Aufgaben in messbare Erfolgskriterien
   übersetzen, mehrstufige Arbeit mit Checkpoints strukturieren.

**Weitere Regeln:**
- Keine Erwähnung von KI-Tools/Assistenten — nirgendwo: nicht im Code, nicht
  in Commits, nicht im README, nicht in der App.
- Sprache: UI-Texte und Doku deutsch, Code-Bezeichner englisch.
- Kein Tracking, keine Cookies, kein `localStorage`/`sessionStorage`.

---

## 1. Projektziel

Interaktive **Baumkarte** als statische Webapp: Einzelbäume aus amtlichen
Geodaten auf einer Karte visualisieren. Muss **mobil gut funktionieren**
(Mobile-First). Hosting vorerst **GitHub Pages**:
`https://bagruber.github.io/baumkarte/` (Repo `bagruber/baumkarte`).

Teil der Familie von Datenprojekten unter `bagruber/*` (moosburg, datahub,
haushaltvis, council) — gleiche Designsprache, gleicher Stack.

---

## 2. Datenlage

### Quelle: LDBV „Einzelbäume" (OpenData Bayern)

- Produkt der Bayerischen Vermessungsverwaltung (LDBV), bayernweit frei
  verfügbar über [geodaten.bayern.de/opengeodata](https://geodaten.bayern.de/opengeodata/OpenDataDetail.html?pn=einzelbaeume)
- Abgeleitet **automatisch aus DOM (Oberflächenmodell) + DOP (Orthophotos)**,
  wird im Zuge der regulären DOM/DOP-Produktion aktualisiert
- Lieferung: **projektgebietsweise GeoPackage-Dateien** (ein „Abschnitt" =
  ein Projektgebiet)
- Lizenz: OpenData der Vermessungsverwaltung, i. d. R. **CC BY 4.0** —
  Quellenvermerk „Datenquelle: Bayerische Vermessungsverwaltung" nötig
  (beim Download final prüfen und im Impressum/Footer nennen)

### Datenformat (aus `einzelbaeume_datenformat.pdf`, Export 11.04.2025)

| Eigenschaft | Wert |
|---|---|
| Koordinatensystem | **EPSG:25832** (UTM 32N) — muss für Webkarten nach EPSG:4326/3857 |
| Geometrie | Punktobjekte (Baumstandort) |
| `id` | Integer64 |
| `dgmhoehe` | Real — Geländehöhe (DGM) am Standort, absolut in m |
| `baumhoehe` | Real — Baumhöhe über DGM in m |

**Das ist alles.** Keine Baumart, kein Kronendurchmesser, kein Pflanzjahr,
kein Zustand. Visualisierbar aus den Rohdaten: **Standort, Baumhöhe,
Dichte/Verteilung** (+ Geländehöhe als Nebeninfo).

### Rohdaten (gesichtet 12.07.2026)

- Datei: `F:\data\124018_baeume.gpkg` (326 MB, **nicht** im Repo)
- **2.868.813 Bäume**, Projektgebiet 124018 = 36 × 26 km,
  Korridor **Moosburg–Landshut** (48,43–48,65° N, 11,81–12,31° O)
- 26 Layer (`5368_trees` … `5393_trees`) — je ein 1-km-Nordwert-Streifen
- Geometrie-Blobs: uniform 29 Byte (8 B GPkg-Header ohne Envelope +
  21 B WKB-Punkt) → direkt per SQLite + numpy lesbar, kein GDAL nötig
- Baumhöhen 5,5–46,2 m (Ø 20,8 m), Gelände 374–502 m ü. NHN
- Optionale Anreicherung später: kommunales **Baumkataster** (Baumarten,
  gepflegte Stadtbäume) — falls von der Stadt zu bekommen; OSM `natural=tree`
  als Ergänzung denkbar

---

## 3. Technik (entschieden & umgesetzt 12.07.2026)

Stack wie die Geschwister: **Vite 6 + React 19 + TypeScript + Tailwind CSS v4**
(`@tailwindcss/vite`), Fonts via `@fontsource` (Inter Variable + Playfair
Display). Kein Router — eine Seite.

**Karte:** **MapLibre GL JS 5** + **PMTiles 4**. Bei 2,9 Mio. Punkten war
GeoJSON raus; PMTiles läuft per HTTP-Range-Requests direkt auf GitHub Pages
(kein Tile-Server). Basiskarte: **basemap.de Vektor, Stil `bm_web_gry`**
(grau, CORS `*`, ohne Key) mit OSM-Raster als Fallback im Code.

**Daten-Pipeline** `etl/build_tiles.py` (Python: numpy, pyproj, pmtiles —
**kein GDAL**, Windows-Wheels dafür existieren nicht für Py 3.14):
- GeoPackage direkt per `sqlite3` lesen, 29-Byte-Blobs mit numpy parsen
- pyproj 25832 → 3857, Tile-Pyramide **z8–z14**, MVT-Encoding von Hand
  (Layer `trees`, extent 4096, Attribute `h` = Baumhöhe 0,1 m quantisiert,
  `g` = Geländehöhe ganzzahlig)
- z14 = alle Bäume (Overzoom darüber hinaus, ~0,4 m Genauigkeit);
  z<14 ausgedünnt: **höchster Baum pro Zelle** (512×512-Raster je Tile)
- Ergebnis: `public/data/baeume.pmtiles`, **52,4 MB** (Achtung: >50 MB
  löst GitHub-Push-Warnung aus, Limit 100 MB; Datei liegt bewusst in Git,
  bei Daten-Updates Git-Historie im Blick behalten)
- Laufzeit ~1 min; `npm run data` (GPKG-Pfad als Argument übergebbar)

**Gelernt (Stolperfallen):**
- MapLibres Stylesheet setzt `position: relative` auf den Container und
  gewinnt gegen Tailwind-Klassen → Karte in Wrapper-Div positionieren,
  Container selbst nur `h-full w-full` (sonst Höhe 0, „leere" Karte)
- GDAL/tippecanoe/WSL/Docker fehlen auf diesem Rechner; pyogrio hätte
  GDAL 3.12 mit PMTiles-Treiber, kann aber Punkte bei Low-Zoom nicht
  räumlich fair ausdünnen — deshalb eigener Tiler
- E2E-Test ohne Setup möglich: Playwright-Chromium liegt in
  `%LOCALAPPDATA%\ms-playwright`, mit `playwright-core` +
  `executablePath` direkt nutzbar

**Deployment** (Konvention aller Geschwister):
- `vite.config.ts`: `base: "/baumkarte/"` — sonst brechen Assets auf Pages
- GitHub Actions `.github/workflows/deploy.yml`, Trigger auf `main`,
  `dist/` → Pages-Artifact; einmalig Repo-Settings → Pages → Source:
  „GitHub Actions"
- Scripts-Konvention: `dev`, `build` (`tsc -b && vite build`), `preview`,
  `typecheck`, ggf. `data` (Python-Pipeline)

---

## 4. Design (Designsprache der Geschwisterprojekte)

Referenz: `../datahub/src/index.css` und `../haushaltvis/src/index.css`
(Moosburg-Rot, Gold-Akzent, warmes Off-White — konsistent über alle Apps).

**Kern-Tokens:**

```css
--color-red-500: #c8102e;   /* Leitfarbe Moosburg-Rot */
--color-red-600: #b00e28;
--color-gold-500: #b8964e;  /* Akzent */
--color-gold-600: #968b69;
--color-cream: #faf7f2;     /* Grundfläche, warmes Off-White */
--color-cream-dark: #f1ece1;
--color-ink: #1c1c1c;       /* Text */
--color-ink-soft: #555555;
--color-ink-muted: #6f6b63; /* AA-geprüft auf Cream */
--color-ink-line: #e4e0d7;  /* Linien/Borders */
--font-display: "Playfair Display", ui-serif, Georgia, serif;   /* Headlines */
--font-sans: "Inter Variable", ui-sans-serif, system-ui, sans-serif;
```

**Familien-Muster, aus `/moosburg` übernommen** (dort am „truesten"):

- **Identitätsblock**: `.eyebrow` (Inter, Versalien, 0.14em, **rot-700**)
  über `.headline` — und `.headline` ist **Versal-Playfair 700**
  (`text-transform: uppercase`, `letter-spacing: 0.01em`, `line-height:1.05`),
  laut Brand-Brief. Darunter normaler Fließtext in `ink-soft`.
- **Keine Regenbogenleiste.** In moosburg/datahub schließt sie den Kopfbereich
  ab, hier war sie einmal drin und wurde wieder entfernt: auf einer
  einfarbig grünen Messwertkarte wirkt sie fremd. An ihrer Stelle trennt eine
  **2px-Goldregel** Identitäts- und Instrumentenblock — sie greift die
  goldene Blattschnitt-Linie auf der Karte auf. Farbige Akzente in dieser
  App nur in **Gold oder Rot**.
- Radien `--radius-sm: 2px` statt scharf eckig, Familien-Schatten
  `--shadow-soft` / `--shadow-lift`, `font-feature-settings: "ss01","cv11"`
  auf `body`, Fokusring nach moosburg-Konvention
  (`:where(a,button,select,textarea)`, rot-500, `--radius-sm`).
- **Zwei Beschriftungs-Rollen**, analog zu moosburgs Unterscheidung
  eyebrow/badge: `.eyebrow` benennt die Karte (0,7rem, farbig), `.label`
  benennt ein Instrument (0,6rem, grau). Gleich gesetzt wären beide unsichtbar.
- **Ladezustand**: moosburgs `RoseLoader` hat hier kein Gegenstück (Wappen-
  Rosen wären wieder eine Bildmarke), aber die Lücke war real — die Karte
  braucht je nach Netz 5–10 s. Jetzt „Karte wird geladen …" im
  `.eyebrow`-Satz in Rot, bis MapLibre `idle` meldet.

**Bewusst nicht übernommen:** Madelon Script (in moosburg „large + sparingly,
one per layout" für emotionale Akzente — auf einer Messwertkarte wäre das
Dekoration), Federzeichnungen/`SketchGround` (falsches Register für amtliche
Geodaten), `.reveal`-Scroll-Animationen (es wird nicht gescrollt).

Weiterhin: große Basisschrift, `prefers-reduced-motion` respektieren,
WCAG 2.1 AA als Minimum.

**Für die Baumkarte spezifisch — Grün-Rampe** (definiert in `src/lib/ramp.ts`,
sequenziell, ein Farbton, hell→dunkel, Startwert ≥3:1 Kontrast auf heller
Basiskarte):

```
5 m  #639436 · 15 m  #3f7d31 · 25 m  #266a31 · 35 m  #14522a · 45 m  #0b3d20
```

Zweitkodierung: Punktradius wächst ab z14 leicht mit der Baumhöhe.

**UI-Konzept „Kartenblatt" (seit 12.07.2026, 5. Runde).** Das Interface ist
*ein* Randblock eines gedruckten Kartenblatts, als Papier auf die Karte
gelegt — kein App-Header, keine schwebenden Dashboard-Cards, kein Modal.
Alles steckt in `components/Plate.tsx`: Titel, Untertitel, Anzahl,
Höhenskala, Mindesthöhen-Regler, ausklappbare Erläuterung, Quellenvermerk.
Regeln dieses Konzepts:

- **Papier, nicht Glas**: deckendes Cream, 1px Haarlinie (`--color-ink-frame`
  außen, `--color-ink-line` innen), **eckige Ecken**, ein weicher Schatten
  mit Versatz (`--shadow-plate`). Kein `backdrop-blur`, keine `rounded-lg`.
- **Typografie trägt**: Playfair-Titel, letterspaced Versalien für Labels
  (`.label`), Tabellenziffern für alle Zahlen.
- **Instrument statt Widget**: Regler = 2px-Lineal mit schmalem Schieber
  (`.rule-slider`), MapLibre-Controls/Popup auf dasselbe Papier getrimmt.
- **Legende zeigt den Zustand**: bei aktivem Filter wird der ausgeblendete
  Teil der Farbskala mit Cream überdeckt — Skala und Regler sind ein Gerät,
  nicht zwei Widgets.
- **Blattschnitt**: gestrichelte Haarlinie in Gold-Braun um das
  Projektgebiet, damit die harte Kante der Punktwolke als Datengrenze
  lesbar ist und nicht als Fehler.
- **Quellenvermerk steht fest im Randblock**, MapLibres Attribution-Overlay
  ist deshalb abgeschaltet (`attributionControl: false`) — es lief mobil
  über den Bildrand hinaus.
- Layout: mobil als **bündiges Bottom-Sheet** an der Unterkante
  (`inset-x-0 bottom-0`, nur `border-t`, Schatten nach oben,
  `env(safe-area-inset-bottom)` im Padding — `viewport-fit=cover` steht
  dafür in der `index.html`), ab `sm` als Block oben links
  (`w-[19.5rem]`, volle Umrandung). `fitBounds` bekommt asymmetrisches
  Padding, damit der Block keine Daten verdeckt; der Maßstab wandert mobil
  nach oben links, weil unten der Randblock sitzt.
- **Kein Logo.** Bewusst entfernt; das Favicon ist die Höhenskala als
  fünfstufiger Balken (`public/favicon.svg`), keine Bildmarke.

**README-Konvention:** Live-Link oben, Hinweisbox „private Eigenentwicklung,
nicht offiziell durch die Stadt beauftragt", Stack-Abschnitt,
Geschwister-Apps-Abschnitt, Verantwortlicher: Benedict Arya Gruber.

---

## 5. Offene Fragen / Ausblick (vom User bestätigt: beides „später ggf.")

1. **Weitere Gebiete/Abschnitte** hinzufügen — Pipeline kann weitere GPKGs
   verarbeiten (Pfad als Argument); dann Tiles zusammenführen oder pro Gebiet
   eine PMTiles-Datei + Gebietswahl. PMTiles-Größe und Git-Historie im Blick
   behalten (aktuell 52 MB, Warnschwelle 50 MB, Limit 100 MB → ggf. Releases
   oder externes Hosting statt Git).
2. **Lokale, ausführlichere Katasterdaten** (kommunales Baumkataster) als
   zweite, zuschaltbare Detail-Ebene (nicht mit den LDBV-Punkten mischen —
   andere Größenordnung: Kataster deckt nur Moosburg ab, vermutlich wenige
   tausend Bäume statt Millionen). Format-/Attribut-Anforderungen für die
   Anfrage an die Stadt (Stand 12.07.2026, ungeprüft):
   - **Format**: praktisch egal — GeoPackage/GeoJSON ideal, Shapefile sehr
     gut (Achtung: DBF-Feldnamen auf 10 Zeichen gekappt, Encoding oft
     Windows-1252/Umlaute, `.prj` prüfen), CSV/Excel nur mit explizit
     benanntem Koordinatensystem, WFS falls Geoportal vorhanden (dann eher
     einmaliger Export als Live-Kopplung). Alle mit `pyogrio`/GDAL lesbar
     (bereits installiert, s. o.) — der SQLite-Direktzugriff aus der
     LDBV-Pipeline ist ein Sonderfall, kein Vorbild für den generischen Fall.
   - **CRS explizit prüfen**: ältere Kommunaldaten oft noch Gauß-Krüger
     (EPSG:31468), nicht UTM32 wie die LDBV-Daten — nicht blind annehmen.
   - **Attribute, Muss**: Baumart (botanisch + deutsch), eindeutige Baum-ID.
   - **Attribute, wünschenswert**: Pflanzjahr/Alter, Stammumfang/BHD,
     Standorttyp (Straßen-/Parkbaum, Naturdenkmal …), Kronendurchmesser.
   - **Attribute, vor Veröffentlichung mit der Stadt klären**: Zustand/
     Vitalität/Schadstufe (wirkt sonst wie Gefahrenkarte), geplante
     Pflegemaßnahmen (eindeutig intern), Eigentümer bei privaten Bäumen
     (dann eher ganz rausfiltern, nur öffentliche Bäume zeigen).
3. Die Baumzahl 2.868.813 ist in App/README hart codiert — bei
   Daten-Updates mitziehen (steht im ETL-Log).

---

## 6. Umweltkontext (Bodenfeuchte, täglich)

`etl/fetch_umwelt.py` + `.github/workflows/umwelt.yml` holen jeden Morgen die
Bodenfeuchte des DWD und schreiben `public/data/umwelt.json`.

- **Quelle**: DWD Climate Data Center, `derived_germany/soil/daily/`
  (AMBETI-Modell). Spalte **`BFGL_AG`** = Bodenfeuchte unter **Gras über Lehm,
  0–60 cm**, in % der nutzbaren Feldkapazität. **Kein Waldboden** — die App
  sagt das ausdrücklich, sonst wäre es eine stille Falschbehauptung.
- **Station**: nächstgelegene zum Gebietsmittelpunkt, aktuell 7075
  Elsendorf-Horneck (24 km). Wird bei jedem Lauf neu bestimmt.
- **Warum ein Referenzwert nötig ist**: „21 % nFK" sagt niemandem etwas. Das
  Skript mittelt denselben Kalendertag ±7 Tage über das ganze Archiv
  (2005–2025) und liefert beides. Stand 16.08.2026: 21 % gegen 83 % normal,
  **0 von 315 Vergleichstagen waren trockener**. Plausibilitätsprobe: die
  bekannten Dürrejahre 2018 (37 %) und 2022 (32 %) erscheinen korrekt als
  bisherige Tiefpunkte — die Spalte wird also richtig gelesen.
- Fehlt `umwelt.json` oder bricht der Abruf, rendert `Bodenfeuchte.tsx`
  nichts. Die Karte funktioniert ohne den Block.
- **Warum der Workflow selbst baut und deployt**: Ein Push mit dem
  `GITHUB_TOKEN` löst keine weiteren Workflows aus. Der Lauf baut deshalb
  direkt aus dem Arbeitsverzeichnis mit den frischen Daten, statt sich auf
  `deploy.yml` zu verlassen.

### Dürreklasse (UFZ-Dürremonitor, SMI)

Zweite Quelle im selben Lauf, seit 18.08.2026. Beantwortet eine **andere
Frage** als der DWD-Wert: nicht „wie viel Wasser ist da", sondern „wie
ungewöhnlich ist das".

- **Datei**: `https://files.ufz.de/~drought/SM_Lall_daily_n14.nc`, letzte 14
  Tage, jede Nacht neu (~2,9 MB). **Gesamtboden**, nicht Oberboden
  (`SM_L02_…`) — Bäume wurzeln tiefer. Der Unterschied ist erheblich:
  am 16.08.2026 Oberboden SMI 0,065, Gesamtboden 0,001. Kurzer Regen netzt
  oben, die Tiefe zeigt das aufgelaufene Defizit.
- **Format**: netCDF-4 (HDF5!), also `h5py`, nicht `scipy.io.netcdf_file`.
  Variable `SMI` (14, 225, 175), Gitter in EPSG:31468, aber `lat`/`lon`
  liegen als 2D-Felder bei — keine Reprojektion nötig. `_FillValue` −9999.
  Achtung: `long_name` sagt „monthly", die Datei ist **täglich**.
- **Klassen laut UFZ** (Vergleichszeitraum 1974–2023): <0,02 außergewöhnliche
  Dürre (50-jährlich), <0,05 extreme (20), <0,10 schwere (10), <0,20
  moderate (5), <0,30 ungewöhnliche Trockenheit (3).
- **Kartenebene, zuschaltbar** (`duerre.geojson`, seit 19.08.2026): echte
  4-km-Quadrate mit sichtbarer Zellkante, `fill-opacity: 0.16`, unter der
  Baumebene. Bewusst **keine** Interpolation — eine weiche Fläche würde eine
  Genauigkeit vortäuschen, die das Raster nicht hat. Standardmäßig aus.
  **Was sie heute leistet und was nicht**: Über den aktuellen Ausschnitt
  liegen 63 Zellen, alle in derselben Klasse (Spannweite 0,008) — es bleibt
  ein gleichmäßiger Ton. Aussagekraft bekommt die Ebene erst, wenn das
  Gebiet auf den restlichen Landkreis wächst oder die Dürre fleckig ist.
  Der Export deckt darum schon `LAYER_BBOX` = 11,45–12,75 / 48,20–48,90 ab
  (469 Zellen, 97 KB), deutlich mehr als die Baumdaten.
- **Statusanzeige = Legende**: Derselbe Fünf-Stufen-Balken im Randblock zeigt
  die aktuelle Klasse und dient bei zugeschalteter Fläche als Legende. Farben
  und Stufenausdruck liegen deshalb gemeinsam in `src/lib/umwelt.ts`
  (`KLASSEN`, `duerreColor`) — nicht doppelt pflegen.
- **Zellkanten brauchen eine eigene Linienebene.** `fill-outline-color`
  zeichnet nur haarfeine Kanten ohne Breitensteuerung und blieb praktisch
  unsichtbar; erst `type: "line"` macht das 4-km-Raster sichtbar.
- **Zeitstrahl über 14 Tage**: Die GeoJSON trägt je Zelle `d0..d13`, die
  `umwelt.json` das Gebietsmittel je Tag. Eigene Felder statt einer Liste,
  weil MapLibre-Ausdrücke damit sicher umgehen — der Regler tauscht nur den
  Schlüssel im `fill-color`-Ausdruck. Tage, nicht Wochen: Die Datei enthält
  14 Tageswerte, Wochen ergäben zwei Punkte. Für einen langen Rückblick
  gäbe es `SMI_Gesamtboden_monatlich.nc` (1950–2024).

### Ruhige Oberfläche (keine Sprünge)

Vom User ausdrücklich gefordert, deshalb festgehalten:

- Die Legendenzeile unter dem Klassenbalken wird **immer** gerendert, nicht
  nur bei zugeschalteter Fläche — sonst wandert der Schalter beim Umlegen.
- Der Zeitstrahl hängt **nicht** am Flächen-Schalter, er steuert Statuszeile
  und Karte gemeinsam und ist immer sichtbar.
- Die Platte hat **mobil eine feste Höhe** (`h-[52dvh]`) mit eigenem
  Scrollbereich statt mitzuwachsen. Weil sie unten angeschlagen ist, würde
  Wachstum alles darüber verschieben. Am Desktop hängt sie oben und darf
  nach unten wachsen. Gemessen: Checkbox-Position in allen Zuständen
  identisch (mobil 767 px, Desktop 398 px).
- Scrollbalken über `.plate-scroll` im Papierton statt im System-Blau.
- **Plausibilitätsprobe**: 0,001 klingt extrem, ist aber im Kontext stimmig —
  deutschlandweit lagen am selben Tag 52,8 % der Fläche in dieser Klasse,
  Bayerns Median 0,0028. Kein Lesefehler.
- **Nutzungsbedingungen**: Die Rechte liegen beim UFZ; unentgeltliche Nutzung
  „im Rahmen von Wissenschaft und Forschung sowie für redaktionelle Zwecke"
  mit dem Vermerk **„UFZ-Dürremonitor/ Helmholtz-Zentrum für
  Umweltforschung"**, der **direkt an der Karte** stehen muss — deshalb steht
  er fest im Randblock und nicht im eingeklappten Text. Anders als die
  LDBV- und DWD-Daten ist das **keine offene Lizenz**; bei kommerzieller
  Nutzung oder Weitergabe erst beim UFZ rückfragen.

### Kein WMS/WFS — geprüft

Der Dürremonitor ist **nicht** als OGC-Dienst verfügbar, entgegen der
naheliegenden Annahme:

- `ufz.de` und `dürremonitor.info` liefern keine Dienst-URLs; die Karten dort
  sind statische PNG/PDF.
- GDI-DE-Katalog: kein Treffer für „Duerremonitor". Unter „Dürre" nur
  Bebauungspläne („Dürre Gärten") und WHYMAP; die Bodenfeuchte-Dienste
  gehören zum **Niedersächsischen** Bodenfeuchteinformationsdienst.
- DWD-Geoserver (`maps.dwd.de/geoserver/ows`, CORS offen): 446 Layer,
  **keiner** zu Boden oder Dürre — reine Wetter-/Satellitenlayer.
- JRC/Copernicus EDO ist nach `drought.emergency.copernicus.eu` umgezogen,
  der alte WMS-Endpunkt antwortet mit 404.

### Verworfen: Grundwasser (GKD Bayern)

Inhaltlich der naheliegendste Kandidat, weil die Isarauen grundwasserabhängig
sind, und es gibt Messstellen im Gebiet (z. B. „WWA Landshut 1A"). Aber: GKD
liefert **keinen** direkten CSV-Endpunkt, die Messwertseiten sind HTML
(`/messwerte/tabelle`, 200, `text/html`), und es fehlt jeder
`Access-Control-Allow-Origin`-Header. Ein HTML-Scraper wäre still brüchig.
Geprüfte Alternativen: **Pegelonline** (WSV) hat volles CORS, führt die Isar
aber nicht (keine Bundeswasserstraße, 0 von 787 Stationen). **DWD OpenData**
und **UFZ-Dürremonitor** haben kein offenes CORS — serverseitig im Workflow
aber problemlos, wie die Bodenfeuchte zeigt.

## 7. Zweites Deploy-Ziel: moosburg.eu/data/baumkarte/

`.github/workflows/hostinger.yml`, gebaut nach dem Muster von
`datahub/.github/workflows/hostinger.yml` — dort steckt die Erfahrung mit
diesem Host.

- **Pfad**: Auf moosburg.eu hängt die Karte als Unterpunkt am Data Hub
  (`/data/` → `/data/baumkarte/`). Auf GitHub Pages bleibt sie unter
  `/baumkarte/`. Zwei Pfade, deshalb `npm run build:hostinger` mit
  `--base=/data/baumkarte/` statt einer Umgebungsvariable — dieselbe
  Konvention wie in datahub.
- **Secrets** (bereits im Repo): `FTP_HOST`, `FTP_USER`, `FTP_PASSWORD`.
  Achtung: **ohne** `HOSTINGER_`-Präfix, anders als anfangs angenommen.
- **`server-dir: data/baumkarte/`** — relativ, ohne `/public_html/`.
- **`timeout: 120000`**: Alle Projekte teilen sich ein FTP-Konto; kurz nach
  einer anderen Übertragung nimmt Hostinger die Verbindung verzögert an, und
  30 s Standard reichen nicht. Dazu die rund 52 MB Kacheln beim ersten Lauf.
- **`public/.htaccess` ist der kritische Teil**: PMTiles wird per HTTP-Range
  gelesen. Würde Apache die Datei per `mod_deflate` komprimieren, verschöben
  sich die Byte-Offsets und die Karte bliebe leer — ohne Fehlermeldung. Die
  Datei schaltet gzip für `.pmtiles` ab und setzt `Accept-Ranges`. Auf
  GitHub Pages wirkungslos. Der Workflow prüft, dass sie im Build liegt.
- Kein SPA-Fallback nötig (anders als datahub): eine einzige Seite, kein
  Router.
- **Card in datahub**: `datahub/src/pages/Home.tsx`, eigener Abschnitt
  „Karten" mit einem normalen `<a>` auf `${BASE_URL}baumkarte/` — die
  Baumkarte ist ein eigener Build, kein Manifest-Datensatz, also keine
  Router-Route.
- **Drei Card-Arten in datahub** (`datahub/src/lib/cardKind.ts`), unterschieden
  nach Herkunft der Zahlen: `umfrage` (weiß, roter Akzent), `statistik`
  (pergamentener Grund, gold) und `eigen` (feine Schraffur, `.card-hatch`).
  Die Schraffur ist bewusst eine Textur statt einer dritten Farbe — die
  Palette bleibt eng, und der Unterschied trägt auch in Graustufen. Die
  Baumkarte ist der erste Fall von `eigen`.
- **Stolperfalle beim Testen**: Läuft parallel noch ein `vite preview`,
  weicht der nächste auf Port 4174/4175 aus. Vor Browser-Tests prüfen, welcher
  Port wirklich bedient wird.

## Changelog

- **19.08.2026 (2)** — Zeitstrahl über 14 Tage, Zellkanten als eigene
  Linienebene, sprungfreie Platte mit fester Höhe mobil, Scrollbalken im
  Papierton. In datahub drei Card-Arten nach Herkunft der Zahlen.
  Hostinger-Deploy läuft (`FTP_HOST` war zunächst falsch gesetzt).
- **19.08.2026** — Dürrefläche als zuschaltbare Kartenebene (4-km-Quadrate,
  schwach getönt, Klassenbalken doppelt als Legende). Deploy nach
  `moosburg.eu/data/baumkarte/` scharf geschaltet, Card in datahub ergänzt.
- **18.08.2026 (2)** — Dürreklasse aus dem UFZ-Dürremonitor ergänzt (SMI,
  Gesamtboden, netCDF per Tageslauf). Als Kartenebene verworfen, weil das
  4-km-Raster über den Ausschnitt nur 63 nahezu gleiche Zellen ergibt.
  Geprüft und dokumentiert: es gibt **keinen** WMS/WFS dafür.
- **18.08.2026** — Bodenfeuchte vom DWD als täglicher Umweltkontext
  (Abschnitt 6) und Hostinger-Deploy für moosburg.eu vorbereitet
  (Abschnitt 7). Grundwasser geprüft und verworfen, Gründe dokumentiert.
- **09.08.2026** — Regenbogenleiste wieder entfernt (passt nicht zu dieser
  Anwendung), stattdessen 2px-Goldregel. Farbakzente hier nur Gold/Rot.
- **07.08.2026** — Familien-Elemente aus `/moosburg` nachgezogen (Details in
  Abschnitt 4): Versal-Playfair-Headline, roter Eyebrow darüber,
  Regenbogenleiste, Familien-Radien/-Schatten, Fokusring-Konvention,
  Ladehinweis. Texte auf LLM-Tells durchgesehen: Gedankenstrich-Appositionen
  („… abgeleitet — daher Standort und Höhe") und Ellipsen ohne Verb
  („ein Tippen die Werte im Detail") raus, dafür kurze Hauptsätze;
  Aufklapper heißt jetzt „Woher die Daten kommen" statt „Über die Daten".
  Randblock mobil bündig an der Unterkante.
- **12.07.2026 (5)** — Interface auf das Kartenblatt-Konzept umgebaut
  (siehe Abschnitt 4): Header und Logo entfernt, Legende + Regler + Info
  zu *einer* Platte zusammengezogen (`Plate.tsx` ersetzt `Legend.tsx` und
  `InfoPanel.tsx`), Blattschnitt-Linie, Attribution in den Randblock geholt.
  Popup **erstmals wirklich verifiziert** (Klick-Raster über Waldstück —
  Canvas-Pixel lassen sich hier nicht auslesen, `drawImage` auf dem
  WebGL-Canvas liefert nichts Brauchbares).
- **12.07.2026 (4)** — Format-/Attribut-Anforderungen für ein künftiges
  kommunales Baumkataster ausgearbeitet (Abschnitt 5.2) — noch keine
  Daten vorhanden, nur Vorbereitung für die Anfrage an die Stadt.
- **12.07.2026 (3)** — Mindesthöhen-Slider in der Legenden-Card
  (`map.setFilter` auf `h`), im Browser verifiziert. Erster Commit + Push.
- **12.07.2026 (2)** — App komplett gebaut und end-to-end verifiziert
  (Playwright: Karte rendert, Range-Requests 206, Popup, Info-Panel, mobil):
  ETL `etl/build_tiles.py` → 52,4-MB-PMTiles; Vite/React/Tailwind-Scaffold;
  MapLibre-Karte mit Höhen-Rampe, Legende, Info-Panel; Deploy-Workflow.
  Rohdaten gesichtet: 2.868.813 Bäume, Gebiet Moosburg–Landshut.
  Noch nicht committet/gepusht.
- **12.07.2026** — Initiale Fassung: Datenblatt ausgewertet, Datenlage &
  Lücken erfasst, Stack- und Designkonventionen aus datahub/haushaltvis/
  moosburg übernommen. Rohdaten noch nicht eingetroffen.

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

**Muster:** Eyebrow-Labels (uppercase, letter-spacing 0.14em, gold),
`.headline` in Playfair 700, große Basisschrift (17/18px), sanfte Schatten
(`--shadow-soft`), sichtbarer `:focus-visible`-Ring in Rot, Skip-Link,
`prefers-reduced-motion` respektieren. WCAG 2.1 AA als Minimum.

**Für die Baumkarte spezifisch — Grün-Rampe** (definiert in `src/lib/ramp.ts`,
sequenziell, ein Farbton, hell→dunkel, Startwert ≥3:1 Kontrast auf heller
Basiskarte):

```
5 m  #639436 · 15 m  #3f7d31 · 25 m  #266a31 · 35 m  #14522a · 45 m  #0b3d20
```

Zweitkodierung: Punktradius wächst ab z14 leicht mit der Baumhöhe.
UI-Muster: Legende als Gradient-Card unten links, Info-Panel als Bottom-Sheet
(mobil) bzw. Modal (Desktop), Popup im Cream-Stil.

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
2. **Lokale, ausführlichere Katasterdaten** (kommunales Baumkataster: Arten,
   Pflanzjahr, Pflege) als zweite Ebene/Quelle.
3. Die Baumzahl 2.868.813 ist in App/README hart codiert — bei
   Daten-Updates mitziehen (steht im ETL-Log).

---

## Changelog

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

# Baumkarte Moosburg–Landshut

**2.868.813 Einzelbäume** zwischen Moosburg an der Isar und Landshut auf einer
interaktiven Karte — jeder Punkt ein Baum, gefärbt nach seiner Höhe. Antippen
zeigt Baumhöhe und Geländehöhe, ein Regler filtert nach Mindesthöhe (z. B. nur
Baumriesen ab 30 m). Mobile-first, rein statisch, ohne Tracking.

🔗 **Live:** [bagruber.github.io/baumkarte](https://bagruber.github.io/baumkarte/)

> ⚠️ **Hinweis:** Dieses Projekt ist eine **private Eigenentwicklung**, kein
> offizielles Angebot einer Behörde. Wünsche und Bug-Reports gerne als
> [GitHub-Issue](https://github.com/bagruber/baumkarte/issues).
> Keine Datenerfassung, kein Tracking, keine Cookies.

## Daten

Grundlage ist der OpenData-Datensatz
[Einzelbäume](https://geodaten.bayern.de/opengeodata/OpenDataDetail.html?pn=einzelbaeume)
der Bayerischen Vermessungsverwaltung (Projektgebiet 124018, GeoPackage,
EPSG:25832): punktgenaue Baumstandorte mit Baumhöhe und Geländehöhe,
automatisch abgeleitet aus dem digitalen Oberflächenmodell und Luftbildern.
Es gibt daher **keine Baumarten** — und Bäume unter ca. 5 m fehlen.

Lizenz der Daten: CC BY 4.0, Datenquelle: Bayerische Vermessungsverwaltung.
Basiskarte: [basemap.de](https://basemap.de) / BKG.

### Dürrelage (täglich)

Die Baumdaten sind ein Schnappschuss aus einer Befliegung. Damit die Karte
eine Gegenwart bekommt, holt eine GitHub Action jeden Morgen zwei Werte:

- die **Dürreklasse** aus dem
  [UFZ-Dürremonitor](https://www.ufz.de/index.php?de=37937) (Bodenfeuchteindex
  SMI, Gesamtboden), gemittelt über die 63 Rasterzellen im Kartenausschnitt —
  ein Rang gegenüber 1974–2023, also *wie ungewöhnlich* die Lage ist;
- das **Bodenwasser** der nächsten Station des
  [Deutschen Wetterdienstes](https://opendata.dwd.de/climate_environment/CDC/derived_germany/soil/daily/)
  in % der nutzbaren Feldkapazität, mit eigenem Vergleich zum langjährigen
  Mittel desselben Kalendertags — also *wie viel Wasser* noch da ist.

Beide beschreiben die Lage in der Gegend, **nicht** den Zustand eines
einzelnen Baums, und sie erklären die Baumhöhen nicht: Die stammen aus einer
Befliegung, die Trockenheit ist von heute.

Quellenvermerk UFZ: *UFZ-Dürremonitor / Helmholtz-Zentrum für
Umweltforschung*. Die UFZ-Daten stehen **nicht** unter einer offenen Lizenz —
frei nutzbar für Wissenschaft und redaktionelle Zwecke mit Quellenangabe
direkt an der Karte.

## Stack

Bewusst minimal — läuft rein statisch auf GitHub Pages.

- **[Vite](https://vite.dev) 6** + **React 19** + **TypeScript**
- **[Tailwind CSS v4](https://tailwindcss.com)** via `@tailwindcss/vite`
- **[MapLibre GL JS](https://maplibre.org)** + **[PMTiles](https://protomaps.com/docs/pmtiles)**
  — die 2,9 Mio. Punkte liegen als einzelne Vector-Tile-Datei im Repo und
  werden per HTTP-Range-Requests gelesen, ganz ohne Tile-Server
- **Python** (numpy, pyproj, pmtiles) für die Daten-Pipeline (`etl/`)

## Lokal entwickeln

```bash
npm install
npm run dev        # Dev-Server auf http://localhost:5173
npm run build      # Produktions-Build nach dist/
npm run typecheck  # nur tsc, kein Build
npm run data       # Tiles neu erzeugen (Python, GeoPackage-Pfad siehe etl/)

python etl/fetch_umwelt.py   # Bodenfeuchte holen (läuft sonst täglich per Action)
```

## Deployment

Zwei Ziele, zwei Pfade:

- **GitHub Pages** — `.github/workflows/deploy.yml`, Basis `/baumkarte/`.
- **moosburg.eu** — `.github/workflows/hostinger.yml`, Basis
  `/data/baumkarte/`: Dort hängt die Karte als Unterpunkt am
  [Data Hub](https://moosburg.eu/data/) und ist von dessen Startseite
  verlinkt.

`public/.htaccess` schaltet die gzip-Komprimierung für `.pmtiles` ab — sie
würde die Byte-Offsets verschieben und die Karte leer lassen, ohne
Fehlermeldung.

## Daten-Pipeline

`etl/build_tiles.py` liest das GeoPackage direkt (SQLite), projiziert nach
WebMercator und schreibt eine Vector-Tile-Pyramide (Zoom 8–14) nach
`public/data/baeume.pmtiles`. Bei Zoom 14 sind alle Bäume enthalten; darunter
wird ausgedünnt: pro Rasterzelle bleibt der **höchste** Baum stehen, damit
Wälder dicht wirken und markante Einzelbäume nicht verschwinden.

Das Roh-GeoPackage (~340 MB) ist bewusst nicht eingecheckt; die fertigen
Tiles (~52 MB) liegen in `public/data/`.

## Ausblick

- Weitere Projektgebiete der Bayernkarte ergänzen (die Pipeline nimmt beliebige
  Einzelbäume-GeoPackages als Argument)
- Kommunale Baumkataster (Baumarten, Pflanzjahr) als zusätzliche Ebene

## Geschwister-Apps

Teil einer kleinen Familie von Daten-Anwendungen für Moosburg:

- **[bagruber/haushaltvis](https://github.com/bagruber/haushaltvis)** — Haushaltsvisualisierung
- **[bagruber/datahub](https://github.com/bagruber/datahub)** — Daten-Dashboards
- **[bagruber/council](https://github.com/bagruber/council)** — Stadtrats-Transparenz
- **bagruber/baumkarte** *(dieses Repo)* — Baumkarte

## Verantwortung

Entwickelt und betrieben von **Benedict Arya Gruber**. Private
Eigenentwicklung — kein offizielles Produkt einer Verwaltung.

Kontakt: [benedict.gruber@fresh.bayern](mailto:benedict.gruber@fresh.bayern) ·
[gruber.am](https://www.gruber.am)

Lizenz: MIT.

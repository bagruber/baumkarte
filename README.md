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

### Bodenfeuchte (täglich)

Die Baumdaten sind ein Schnappschuss aus einer Befliegung. Damit die Karte
eine Gegenwart bekommt, holt eine GitHub Action jeden Morgen die Bodenfeuchte
der nächstgelegenen Station des
[Deutschen Wetterdienstes](https://opendata.dwd.de/climate_environment/CDC/derived_germany/soil/daily/)
und stellt sie dem langjährigen Mittel desselben Kalendertags gegenüber
(Archiv ab 2005). Ohne diesen Vergleich wäre ein Wert wie „21 % nFK" nicht
einzuordnen.

Der Wert gilt für Gras über Lehm bis 60 cm Tiefe — **nicht für Waldboden**,
und er stammt nicht von diesen Bäumen. Er beschreibt die Lage in der Gegend,
nicht den Zustand eines einzelnen Baums.

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

- **GitHub Pages** — `.github/workflows/deploy.yml`, bei jedem Push auf `main`.
- **moosburg.eu (Hostinger)** — `.github/workflows/deploy-hostinger.yml`,
  vorbereitet, aber inert: Ohne hinterlegte Zugangsdaten überspringt der Lauf
  sich selbst. Nötig sind die Secrets `HOSTINGER_FTP_HOST`,
  `HOSTINGER_FTP_USER`, `HOSTINGER_FTP_PASSWORD` sowie die Variables
  `HOSTINGER_REMOTE_DIR` und `HOSTINGER_BASE_PATH`.

Der Build-Pfad kommt aus `BASE_PATH` (Vorgabe `/baumkarte/`): `/` für eine
eigene Subdomain, `/baumkarte/` für einen Unterordner. `public/.htaccess`
schaltet die gzip-Komprimierung für `.pmtiles` ab — sie würde die
Byte-Offsets verschieben und die Karte leer lassen.

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

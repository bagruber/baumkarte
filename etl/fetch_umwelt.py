"""Taeglicher Umweltkontext zur Baumkarte: Duerreklasse und Bodenfeuchte.

Zwei Quellen, zwei verschiedene Aussagen:

1. UFZ-Duerremonitor (SMI) — wie *ungewoehnlich* ist es, als Perzentil gegen
   1974-2023. Deckt das Kartengebiet flaechig ab (63 Zellen a 4 km) und
   liefert die Duerreklassen, die man aus den Nachrichten kennt.
2. DWD — wie *viel* Wasser tatsaechlich im Boden ist, in % der nutzbaren
   Feldkapazitaet, plus eigener Vergleich mit dem langjaehrigen Mittel
   desselben Kalendertags.

Ergebnis: public/data/umwelt.json — fehlt die Datei, blendet die App den
Block einfach aus.

Aufruf:  python etl/fetch_umwelt.py
"""

import gzip
import json
import re
import tempfile
import urllib.request
from datetime import date, datetime, timedelta
from pathlib import Path

import h5py
import numpy as np

CDC = "https://opendata.dwd.de/climate_environment/CDC/derived_germany/soil/daily/"
OUT = Path(__file__).resolve().parent.parent / "public" / "data" / "umwelt.json"

# Mitte des Projektgebiets 124018
CLAT, CLON = 48.541, 12.062

# Bodenfeuchte unter Gras ueber Lehm, 0-60 cm, in % der nutzbaren
# Feldkapazitaet. Kein Waldboden — die ehrliche Beschriftung steht in der App.
COLUMN = "BFGL_AG"

# Fenster um den Kalendertag, ueber das gemittelt wird (glaettet Ausreisser)
WINDOW_DAYS = 7

# UFZ-Duerremonitor, Gesamtboden — Baeume wurzeln tiefer als die 25 cm der
# Oberboden-Datei. Wird jede Nacht neu erzeugt, rund 2,9 MB.
SMI_URL = "https://files.ufz.de/~drought/SM_Lall_daily_n14.nc"

# Grenzen des Projektgebiets 124018 (Reihenfolge W, S, O, N)
BBOX = (11.812, 48.4308, 12.3131, 48.6514)

# Fuer die Kartenebene groesser gefasst als die Baumdaten: deckt den
# schwenkbaren Bereich ab und traegt schon, wenn das Gebiet spaeter auf den
# restlichen Landkreis waechst.
LAYER_BBOX = (11.45, 48.20, 12.75, 48.90)

GEOJSON_OUT = Path(__file__).resolve().parent.parent / "public" / "data" / "duerre.geojson"

# Duerreklassen nach UFZ. Obergrenze (exklusiv) -> Bezeichnung, Jaehrlichkeit.
SMI_CLASSES = [
    (0.02, "außergewöhnliche Dürre", 50),
    (0.05, "extreme Dürre", 20),
    (0.10, "schwere Dürre", 10),
    (0.20, "moderate Dürre", 5),
    (0.30, "ungewöhnliche Trockenheit", 3),
]


def fetch(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": "baumkarte-etl"})
    return urllib.request.urlopen(req, timeout=120).read()


def nearest_station() -> tuple[int, str, float]:
    raw = fetch(CDC + "recent/derived_germany_soil_daily_recent_stations_list.txt")
    best = None
    for line in raw.decode("latin-1").splitlines()[2:]:
        parts = line.split(";")
        if len(parts) < 6:
            continue
        try:
            sid, lat, lon = int(parts[0]), float(parts[2]), float(parts[3])
        except ValueError:
            continue
        # grobe Distanz in km, reicht fuer die Auswahl
        km = (((lat - CLAT) * 111.2) ** 2 + ((lon - CLON) * 73.4) ** 2) ** 0.5
        if best is None or km < best[2]:
            best = (sid, parts[4].strip(), km)
    if best is None:
        raise SystemExit("keine DWD-Station gefunden")
    return best


def read_series(url: str) -> dict[date, float]:
    """Datum -> Bodenfeuchte, fuer eine DWD-Stationsdatei."""
    text = gzip.decompress(fetch(url)).decode("latin-1")
    lines = text.strip().splitlines()
    header = [h.strip() for h in lines[0].split(";")]
    col = header.index(COLUMN)
    out = {}
    for line in lines[1:]:
        parts = line.split(";")
        if len(parts) <= col:
            continue
        try:
            day = datetime.strptime(parts[1].strip(), "%Y%m%d").date()
            value = float(parts[col])
        except ValueError:
            continue
        if value > -900:  # DWD-Fehlkennung
            out[day] = value
    return out


def day_distance(day: date, month: int, dom: int) -> int:
    """Abstand zweier Kalendertage in Tagen, jahresuebergreifend.

    Rechnet in einem Nicht-Schaltjahr, damit der 29. Februar die Action nicht
    alle vier Jahre abstuerzen laesst.
    """

    def flatten(m: int, d: int) -> date:
        return date(2001, 3, 1) if (m, d) == (2, 29) else date(2001, m, d)

    delta = abs((flatten(day.month, day.day) - flatten(month, dom)).days)
    return min(delta, 365 - delta)


def smi_klasse(value: float) -> tuple[str, int | None]:
    for limit, label, wiederkehr in SMI_CLASSES:
        if value < limit:
            return label, wiederkehr
    return "keine Dürre", None


def write_layer(smi, lat, lon, easting, northing, tage) -> None:
    """Rasterzellen als GeoJSON-Quadrate fuer die zuschaltbare Kartenebene.

    Die Zellmittelpunkte liegen in EPSG:31468 auf einem regelmaessigen Gitter;
    die Ecken lassen sich daraus exakt bilden und nach WGS84 umrechnen. Bewusst
    echte Quadrate statt interpolierter Flaeche: Das Raster ist 4 km grob, und
    eine weiche Flaeche wuerde eine Genauigkeit vortaeuschen, die es nicht gibt.

    Jede Zelle traegt alle Tage als d0..dN. Eigene Felder statt einer Liste,
    weil MapLibre-Ausdruecke damit sicher umgehen: der Zeitstrahl tauscht nur
    den Schluessel im fill-color-Ausdruck.
    """
    from pyproj import Transformer

    w, s, e, n = LAYER_BBOX
    rows, cols = np.where((lat >= s) & (lat <= n) & (lon >= w) & (lon <= e))
    if rows.size == 0:
        return

    dx = abs(easting[1] - easting[0]) / 2
    dy = abs(northing[1] - northing[0]) / 2
    to_wgs = Transformer.from_crs(31468, 4326, always_xy=True)

    features = []
    for r, c in zip(rows, cols):
        werte = smi[:, r, c]
        if np.isnan(werte).all():
            continue
        props = {
            f"d{i}": (None if np.isnan(v) else round(float(v), 4))
            for i, v in enumerate(werte)
        }
        x, y = easting[c], northing[r]
        xs = [x - dx, x + dx, x + dx, x - dx, x - dx]
        ys = [y - dy, y - dy, y + dy, y + dy, y - dy]
        lons, lats = to_wgs.transform(xs, ys)
        features.append(
            {
                "type": "Feature",
                "properties": props,
                "geometry": {
                    "type": "Polygon",
                    "coordinates": [[[round(a, 5), round(b, 5)] for a, b in zip(lons, lats)]],
                },
            }
        )

    GEOJSON_OUT.parent.mkdir(parents=True, exist_ok=True)
    GEOJSON_OUT.write_text(
        json.dumps(
            {
                "type": "FeatureCollection",
                "tage": [d.isoformat() for d in tage],
                "features": features,
            },
            ensure_ascii=False,
        )
        + "\n",
        encoding="utf-8",
    )
    size = GEOJSON_OUT.stat().st_size / 1024
    print(f"{len(features)} Rasterzellen x {len(tage)} Tage -> {GEOJSON_OUT} ({size:.0f} KB)")


def fetch_smi() -> dict | None:
    """Duerreindex des UFZ, gemittelt ueber das Kartengebiet.

    Das Raster hat 4 km Zellen; ueber den Ausschnitt bleiben rund 60 davon.
    Als Kartenebene waere das zu grob, als Kennzahl fuers Gebiet taugt es.
    """
    try:
        with tempfile.NamedTemporaryFile(suffix=".nc", delete=False) as tmp:
            tmp.write(fetch(SMI_URL))
            path = tmp.name

        with h5py.File(path, "r") as f:
            smi = np.asarray(f["SMI"][:], dtype="float32")
            lat, lon = f["lat"][:], f["lon"][:]
            times = f["time"][:]
            units = f["time"].attrs["units"]
            units = units.decode() if isinstance(units, bytes) else units
            easting, northing = f["easting"][:], f["northing"][:]

        Path(path).unlink(missing_ok=True)

        smi = np.where(smi <= -9000, np.nan, smi)
        w, s, e, n = BBOX
        mask = (lat >= s) & (lat <= n) & (lon >= w) & (lon <= e)
        if not mask.any():
            return None

        # "days since 2023-01-30 00:00:00"
        m = re.search(r"days since (\d{4})-(\d{2})-(\d{2})", units)
        epoch = date(*(int(g) for g in m.groups())) if m else None
        if epoch is None:
            return None
        tage = [epoch + timedelta(days=int(t)) for t in times]

        write_layer(smi, lat, lon, easting, northing, tage)

        # Gebietsmittel je Tag — traegt den Zeitstrahl in der App
        serie = []
        for tag, layer in zip(tage, smi):
            cells = layer[mask]
            cells = cells[~np.isnan(cells)]
            if cells.size == 0:
                continue
            mittel = float(cells.mean())
            label, wiederkehr = smi_klasse(mittel)
            serie.append(
                {
                    "stand": tag.isoformat(),
                    "smi": round(mittel, 3),
                    "klasse": label,
                    "wiederkehr_jahre": wiederkehr,
                }
            )
        if not serie:
            return None

        return {
            "serie": serie,
            "zellen": int((~np.isnan(smi[-1][mask])).sum()),
            "referenz_zeitraum": "1974–2023",
            "quelle": "UFZ-Dürremonitor / Helmholtz-Zentrum für Umweltforschung",
        }
    except Exception as exc:  # noqa: BLE001 — Ausfall darf den Lauf nicht kippen
        print(f"SMI nicht abrufbar: {exc}")
        return None


def main() -> None:
    sid, name, km = nearest_station()
    print(f"Station {sid} {name}, {km:.0f} km von der Kartenmitte")

    recent = read_series(f"{CDC}recent/derived_germany_soil_daily_recent_v2_{sid}.txt.gz")
    history = read_series(
        f"{CDC}historical/derived_germany_soil_daily_historical_v2_{sid}.txt.gz"
    )
    if not recent:
        raise SystemExit("keine aktuellen Messwerte")

    latest = max(recent)
    current = recent[latest]

    # Langjaehriges Mittel fuer denselben Kalendertag (+/- WINDOW_DAYS),
    # aus allen Jahren des Archivs
    same_season = [
        v for d, v in history.items() if day_distance(d, latest.month, latest.day) <= WINDOW_DAYS
    ]
    years = sorted({d.year for d in history})
    reference = round(sum(same_season) / len(same_season)) if same_season else None

    # Wie oft war es zu dieser Jahreszeit schon einmal so trocken? 0 = noch nie.
    drier = sum(1 for v in same_season if v < current)

    payload = {
        "stand": latest.isoformat(),
        "abgerufen": date.today().isoformat(),
        "station": {"id": sid, "name": name, "entfernung_km": round(km)},
        "bodenfeuchte": {
            "aktuell": round(current),
            "referenz": reference,
            "referenz_zeitraum": f"{years[0]}–{years[-1]}" if years else None,
            "trockenere_vergleichstage": drier,
            "vergleichstage": len(same_season),
            "einheit": "% nFK",
        },
        "quelle": "Deutscher Wetterdienst, Climate Data Center",
    }

    duerre = fetch_smi()
    if duerre:
        payload["duerre"] = duerre
        letzte = duerre["serie"][-1]
        print(
            f"SMI {letzte['smi']:.3f} ({letzte['klasse']}) am {letzte['stand']}, "
            f"{duerre['zellen']} Rasterzellen, {len(duerre['serie'])} Tage"
        )

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(
        f"{latest}: {current:.0f} % nFK, langjaehriges Mittel {reference} % "
        f"({len(same_season)} Vergleichstage) -> {OUT}"
    )


if __name__ == "__main__":
    main()

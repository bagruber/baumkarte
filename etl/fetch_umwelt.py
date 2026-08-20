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

# Pflanzenverfuegbares Wasser im Oberboden (0-25 cm), % der nutzbaren
# Feldkapazitaet. Anders als der SMI ein absoluter Wert, und anders als die
# DWD-Station flaechig. Gleiches 4-km-Gitter wie der SMI, aber eigene
# Zeitachse: Die Datei reicht meist ein bis zwei Tage weiter.
NFK_URL = "https://files.ufz.de/~drought/nFK_0_25_daily_n14.nc"

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


class Raster:
    """Ein UFZ-Datensatz: Werte je Tag und Zelle, plus Gitter und Datumsliste."""

    def __init__(self, werte, lat, lon, easting, northing, tage):
        self.werte = werte
        self.lat = lat
        self.lon = lon
        self.easting = easting
        self.northing = northing
        self.tage = tage


def lade_raster(url: str, variable: str) -> Raster | None:
    """Eine netCDF-Datei vom UFZ einlesen.

    Die Zeitachse ist nicht einheitlich: Der SMI zaehlt Tage seit einem
    Stichtag, die nFK-Datei Stunden. Beide Faelle werden abgedeckt.
    """
    path = None
    try:
        with tempfile.NamedTemporaryFile(suffix=".nc", delete=False) as tmp:
            tmp.write(fetch(url))
            path = tmp.name

        with h5py.File(path, "r") as f:
            werte = np.asarray(f[variable][:], dtype="float32")
            lat, lon = f["lat"][:], f["lon"][:]
            times = f["time"][:]
            units = f["time"].attrs["units"]
            units = units.decode() if isinstance(units, bytes) else units
            easting, northing = f["easting"][:], f["northing"][:]

        werte = np.where(werte <= -9000, np.nan, werte)

        m = re.search(r"(days|hours) since (\d{4})-(\d{2})-(\d{2})", units)
        if not m:
            print(f"{variable}: Zeitachse nicht lesbar ({units})")
            return None
        einheit, *teile = m.groups()
        epoch = date(*(int(g) for g in teile))
        faktor = timedelta(days=1) if einheit == "days" else timedelta(hours=1)
        tage = [epoch + faktor * int(t) for t in times]

        return Raster(werte, lat, lon, easting, northing, tage)
    except Exception as exc:  # noqa: BLE001 — Ausfall darf den Lauf nicht kippen
        print(f"{variable} nicht abrufbar: {exc}")
        return None
    finally:
        if path:
            Path(path).unlink(missing_ok=True)


def write_layer(duerre: Raster, wasser: Raster | None) -> None:
    """Rasterzellen als GeoJSON-Quadrate fuer die zuschaltbaren Kartenebenen.

    Die Zellmittelpunkte liegen in EPSG:31468 auf einem regelmaessigen Gitter;
    die Ecken lassen sich daraus exakt bilden und nach WGS84 umrechnen. Bewusst
    echte Quadrate statt interpolierter Flaeche: Das Raster ist 4 km grob, und
    eine weiche Flaeche wuerde eine Genauigkeit vortaeuschen, die es nicht gibt.

    Beide Quellen teilen sich Gitter und Datei, tragen aber eigene Felder
    (d0..dN fuer die Duerre, w0..wN fuer das Wasser) und eigene Datumslisten:
    Die nFK-Datei reicht meist ein bis zwei Tage weiter als der SMI. Eigene
    Felder statt einer Liste, weil MapLibre-Ausdruecke damit sicher umgehen —
    der Zeitstrahl tauscht nur den Schluessel im fill-color-Ausdruck.
    """
    from pyproj import Transformer

    w, s, e, n = LAYER_BBOX
    lat, lon = duerre.lat, duerre.lon
    rows, cols = np.where((lat >= s) & (lat <= n) & (lon >= w) & (lon <= e))
    if rows.size == 0:
        return

    gleiches_gitter = wasser is not None and wasser.werte.shape[1:] == duerre.werte.shape[1:]
    if wasser is not None and not gleiches_gitter:
        print("Warnung: nFK liegt auf anderem Gitter, Wasserebene entfaellt")

    dx = abs(duerre.easting[1] - duerre.easting[0]) / 2
    dy = abs(duerre.northing[1] - duerre.northing[0]) / 2
    to_wgs = Transformer.from_crs(31468, 4326, always_xy=True)

    features = []
    for r, c in zip(rows, cols):
        smi_werte = duerre.werte[:, r, c]
        if np.isnan(smi_werte).all():
            continue
        props = {
            f"d{i}": (None if np.isnan(v) else round(float(v), 4))
            for i, v in enumerate(smi_werte)
        }
        if gleiches_gitter:
            props.update(
                {
                    f"w{i}": (None if np.isnan(v) else round(float(v), 1))
                    for i, v in enumerate(wasser.werte[:, r, c])
                }
            )
        x, y = duerre.easting[c], duerre.northing[r]
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
                "tage": [d.isoformat() for d in duerre.tage],
                "tage_wasser": [d.isoformat() for d in wasser.tage] if gleiches_gitter else None,
                "features": features,
            },
            ensure_ascii=False,
        )
        + "\n",
        encoding="utf-8",
    )
    size = GEOJSON_OUT.stat().st_size / 1024
    print(
        f"{len(features)} Rasterzellen, {len(duerre.tage)} Tage Dürre"
        f"{f', {len(wasser.tage)} Tage Wasser' if gleiches_gitter else ''}"
        f" -> {GEOJSON_OUT} ({size:.0f} KB)"
    )


def gebietsmittel(raster: Raster) -> list[tuple[date, float]]:
    """Mittelwert je Tag ueber das Projektgebiet."""
    w, s, e, n = BBOX
    mask = (raster.lat >= s) & (raster.lat <= n) & (raster.lon >= w) & (raster.lon <= e)
    out = []
    for tag, layer in zip(raster.tage, raster.werte):
        cells = layer[mask]
        cells = cells[~np.isnan(cells)]
        if cells.size:
            out.append((tag, float(cells.mean())))
    return out


def fetch_umweltraster() -> tuple[dict | None, dict | None]:
    """Duerreindex und pflanzenverfuegbares Wasser, beide vom UFZ."""
    duerre = lade_raster(SMI_URL, "SMI")
    if duerre is None:
        return None, None
    wasser = lade_raster(NFK_URL, "nFK")

    # Scheitert der Export, sollen die DWD-Werte trotzdem aktualisiert werden.
    # Die vorhandene GeoJSON bleibt dann stehen, deshalb laut melden.
    try:
        write_layer(duerre, wasser)
    except Exception as exc:  # noqa: BLE001
        print(f"WARNUNG: Kartenebene nicht geschrieben ({exc}), alte Datei bleibt")

    serie = []
    for tag, mittel in gebietsmittel(duerre):
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
        return None, None

    w, s, e, n = BBOX
    mask = (duerre.lat >= s) & (duerre.lat <= n) & (duerre.lon >= w) & (duerre.lon <= e)
    duerre_out = {
        "serie": serie,
        "zellen": int((~np.isnan(duerre.werte[-1][mask])).sum()),
        "referenz_zeitraum": "1974–2023",
        "quelle": "UFZ-Dürremonitor / Helmholtz-Zentrum für Umweltforschung",
    }

    wasser_out = None
    if wasser is not None:
        reihe = gebietsmittel(wasser)
        if reihe:
            wasser_out = {
                "serie": [
                    {"stand": tag.isoformat(), "nfk": round(mittel, 1)} for tag, mittel in reihe
                ],
                "einheit": "% nFK",
                "tiefe": "0–25 cm",
                "quelle": "UFZ-Dürremonitor / Helmholtz-Zentrum für Umweltforschung",
            }

    return duerre_out, wasser_out


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

    duerre, wasser = fetch_umweltraster()
    if duerre:
        payload["duerre"] = duerre
        letzte = duerre["serie"][-1]
        print(
            f"SMI {letzte['smi']:.3f} ({letzte['klasse']}) am {letzte['stand']}, "
            f"{duerre['zellen']} Rasterzellen, {len(duerre['serie'])} Tage"
        )
    if wasser:
        payload["wasser"] = wasser
        lw = wasser["serie"][-1]
        print(f"nFK {lw['nfk']:.1f} % am {lw['stand']}, {len(wasser['serie'])} Tage")

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(
        f"{latest}: {current:.0f} % nFK, langjaehriges Mittel {reference} % "
        f"({len(same_season)} Vergleichstage) -> {OUT}"
    )


if __name__ == "__main__":
    main()

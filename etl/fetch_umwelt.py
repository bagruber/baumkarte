"""Taeglicher Umweltkontext zur Baumkarte: Bodenfeuchte vom DWD.

Holt die Bodenfeuchte der naechstgelegenen DWD-Station zum Kartengebiet und
stellt den aktuellen Wert dem langjaehrigen Mittel desselben Kalendertags
gegenueber. Ohne diesen Vergleich sagt "21 % nFK" niemandem etwas.

Ergebnis: public/data/umwelt.json — fehlt die Datei, blendet die App den
Block einfach aus.

Aufruf:  python etl/fetch_umwelt.py
"""

import gzip
import json
import urllib.request
from datetime import date, datetime
from pathlib import Path

CDC = "https://opendata.dwd.de/climate_environment/CDC/derived_germany/soil/daily/"
OUT = Path(__file__).resolve().parent.parent / "public" / "data" / "umwelt.json"

# Mitte des Projektgebiets 124018
CLAT, CLON = 48.541, 12.062

# Bodenfeuchte unter Gras ueber Lehm, 0-60 cm, in % der nutzbaren
# Feldkapazitaet. Kein Waldboden — die ehrliche Beschriftung steht in der App.
COLUMN = "BFGL_AG"

# Fenster um den Kalendertag, ueber das gemittelt wird (glaettet Ausreisser)
WINDOW_DAYS = 7


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

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(
        f"{latest}: {current:.0f} % nFK, langjaehriges Mittel {reference} % "
        f"({len(same_season)} Vergleichstage) -> {OUT}"
    )


if __name__ == "__main__":
    main()

"""GeoPackage (LDBV Einzelbaeume) -> PMTiles fuer die Web-App.

Liest alle *_trees-Layer aus dem GeoPackage, projiziert EPSG:25832 -> WebMercator
und schreibt eine Vector-Tile-Pyramide (Zoom 8-14) nach public/data/baeume.pmtiles.

Bei Zoom < 14 wird ausgeduennt: pro Rasterzelle (512x512 je Tile) bleibt der
hoechste Baum stehen — Waelder bleiben visuell dicht, Einzelbaeume gehen nicht
verloren, und die Tiles bleiben klein genug fuer Mobile.

Attribute je Baum im Tile-Layer "trees":
  h = Baumhoehe in m (0.1 m quantisiert)
  g = Gelaendehoehe (DGM) in m (ganzzahlig)

Aufruf:  python etl/build_tiles.py [pfad/zur/datei.gpkg]
"""

import gzip
import json
import sqlite3
import struct
import sys
import time
from pathlib import Path

import numpy as np
from pmtiles.tile import Compression, TileType, zxy_to_tileid
from pmtiles.writer import Writer
from pyproj import Transformer

GPKG = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(r"F:\data\124018_baeume.gpkg")
OUT = Path(__file__).resolve().parent.parent / "public" / "data" / "baeume.pmtiles"

MINZOOM, MAXZOOM = 8, 14
EXTENT = 4096          # MVT-Koordinatenaufloesung je Tile
THIN_GRID = 512        # Ausduennungsraster je Tile (Zellen pro Kante)
ORIGIN = 20037508.342789244  # WebMercator-Halbwelt in m


def load_points():
    """Alle Layer lesen; Rueckgabe: x, y (EPSG:25832), baumhoehe, dgmhoehe."""
    db = sqlite3.connect(GPKG)
    layers = [r[0] for r in db.execute(
        "SELECT table_name FROM gpkg_contents WHERE data_type='features'")]
    xs, ys, hs, gs = [], [], [], []
    for layer in layers:
        rows = db.execute(f'SELECT geom, baumhoehe, dgmhoehe FROM "{layer}"').fetchall()
        blob = b"".join(r[0] for r in rows)
        arr = np.frombuffer(blob, dtype=np.uint8).reshape(len(rows), 29)
        # GPkg-Header 8 B (ohne Envelope) + WKB-Punkt: endian(1) type(4) x(8) y(8)
        assert arr[0, 0] == 0x47 and arr[0, 8] == 1, "unerwartetes Geometrie-Format"
        xs.append(arr[:, 13:21].copy().view(np.float64).ravel())
        ys.append(arr[:, 21:29].copy().view(np.float64).ravel())
        hs.append(np.array([r[1] for r in rows]))
        gs.append(np.array([r[2] for r in rows]))
        print(f"  {layer}: {len(rows):,}")
    db.close()
    return (np.concatenate(xs), np.concatenate(ys),
            np.concatenate(hs), np.concatenate(gs))


# --- Minimal-Encoder fuer Mapbox Vector Tiles (nur Punkte) -------------------

def varint(buf, v):
    while v > 0x7F:
        buf.append((v & 0x7F) | 0x80)
        v >>= 7
    buf.append(v)


def field_bytes(buf, tag, payload):
    varint(buf, (tag << 3) | 2)
    varint(buf, len(payload))
    buf.extend(payload)


def encode_tile(px, py, hq, gq):
    """Ein Tile als MVT: px/py in [0, EXTENT), hq/gq quantisierte Attribute."""
    # Wertetabelle: erst h-Werte (float), dann g-Werte (int)
    h_vals, h_idx = np.unique(hq, return_inverse=True)
    g_vals, g_idx = np.unique(gq, return_inverse=True)
    g_idx = g_idx + len(h_vals)

    feats = bytearray()
    zx = ((px << 1) ^ (px >> 31)).astype(np.uint32)  # Zigzag
    zy = ((py << 1) ^ (py >> 31)).astype(np.uint32)
    for i in range(len(px)):
        geom = bytearray()
        varint(geom, 9)  # MoveTo, count 1
        varint(geom, zx[i])
        varint(geom, zy[i])
        tags = bytearray()
        varint(tags, 0); varint(tags, h_idx[i])
        varint(tags, 1); varint(tags, g_idx[i])
        f = bytearray()
        field_bytes(f, 2, tags)          # tags
        f.append((3 << 3) | 0); varint(f, 1)  # type = POINT
        field_bytes(f, 4, geom)          # geometry
        field_bytes(feats, 2, f)         # Layer.features

    layer = bytearray()
    layer.append((15 << 3) | 0); varint(layer, 2)      # version
    field_bytes(layer, 1, b"trees")                     # name
    layer.extend(feats)
    for key in (b"h", b"g"):                            # keys
        field_bytes(layer, 3, key)
    for v in h_vals:                                    # values: float h
        val = bytearray(); val.append((2 << 3) | 5); val.extend(struct.pack("<f", v))
        field_bytes(layer, 4, val)
    for v in g_vals:                                    # values: int g
        val = bytearray(); val.append((4 << 3) | 0); varint(val, int(v))
        field_bytes(layer, 4, val)
    layer.append((5 << 3) | 0); varint(layer, EXTENT)   # extent

    tile = bytearray()
    field_bytes(tile, 3, layer)  # Tile.layers
    return bytes(tile)


def main():
    t0 = time.time()
    print(f"Lese {GPKG} ...")
    x, y, h, g = load_points()
    n = len(x)
    print(f"{n:,} Baeume geladen ({time.time()-t0:.0f}s)")

    tf = Transformer.from_crs(25832, 3857, always_xy=True)
    mx, my = tf.transform(x, y)
    nx = (mx / ORIGIN + 1) / 2           # normiert 0..1
    ny = (1 - my / ORIGIN) / 2
    order = np.argsort(-h)               # hoechste zuerst (fuer Ausduennung)

    hq = np.round(h, 1).astype(np.float32)
    gq = np.round(g).astype(np.uint32)

    tiles = {}  # (z, tx, ty) -> mvt bytes
    for z in range(MAXZOOM, MINZOOM - 1, -1):
        scale = (1 << z) * THIN_GRID
        cx = np.minimum((nx * scale).astype(np.int64), scale - 1)
        cy = np.minimum((ny * scale).astype(np.int64), scale - 1)
        if z == MAXZOOM:
            keep = np.arange(n)
        else:
            cell = (cx[order] << 32) | cy[order]
            _, first = np.unique(cell, return_index=True)
            keep = order[first]
        tx, ty = cx[keep] >> 9, cy[keep] >> 9
        # Pixelkoordinate im Tile (0..EXTENT)
        fac = (1 << z) * EXTENT
        px = (np.minimum((nx[keep] * fac).astype(np.int64), fac - 1) - tx * EXTENT).astype(np.int32)
        py = (np.minimum((ny[keep] * fac).astype(np.int64), fac - 1) - ty * EXTENT).astype(np.int32)

        tid = (tx << 32) | ty
        srt = np.argsort(tid, kind="stable")
        tid, px, py = tid[srt], px[srt], py[srt]
        khq, kgq = hq[keep][srt], gq[keep][srt]
        bounds = np.flatnonzero(np.diff(tid)) + 1
        starts = np.concatenate([[0], bounds])
        ends = np.concatenate([bounds, [len(tid)]])
        for s, e in zip(starts, ends):
            key = (z, int(tid[s] >> 32), int(tid[s] & 0xFFFFFFFF))
            tiles[key] = encode_tile(px[s:e], py[s:e], khq[s:e], kgq[s:e])
        print(f"z{z}: {len(keep):,} Punkte, {len(starts)} Tiles ({time.time()-t0:.0f}s)")

    # Bounds in WGS84 fuer den Header
    tf4326 = Transformer.from_crs(25832, 4326, always_xy=True)
    lon0, lat0 = tf4326.transform(x.min(), y.min())
    lon1, lat1 = tf4326.transform(x.max(), y.max())

    OUT.parent.mkdir(parents=True, exist_ok=True)
    with open(OUT, "wb") as f:
        w = Writer(f)
        entries = sorted((zxy_to_tileid(z, tx, ty), data)
                         for (z, tx, ty), data in tiles.items())
        for tileid, data in entries:
            w.write_tile(tileid, gzip.compress(data))
        w.finalize(
            {
                "tile_type": TileType.MVT,
                "tile_compression": Compression.GZIP,
                "min_zoom": MINZOOM,
                "max_zoom": MAXZOOM,
                "min_lon_e7": int(lon0 * 1e7),
                "min_lat_e7": int(lat0 * 1e7),
                "max_lon_e7": int(lon1 * 1e7),
                "max_lat_e7": int(lat1 * 1e7),
                "center_zoom": 11,
                "center_lon_e7": int((lon0 + lon1) / 2 * 1e7),
                "center_lat_e7": int((lat0 + lat1) / 2 * 1e7),
            },
            {
                "name": "Einzelbaeume 124018",
                "attribution": "Datenquelle: Bayerische Vermessungsverwaltung",
                "vector_layers": [{
                    "id": "trees",
                    "minzoom": MINZOOM,
                    "maxzoom": MAXZOOM,
                    "fields": {"h": "Number", "g": "Number"},
                }],
            },
        )
    print(f"OK -> {OUT} ({OUT.stat().st_size/1e6:.1f} MB, {time.time()-t0:.0f}s)")


if __name__ == "__main__":
    main()

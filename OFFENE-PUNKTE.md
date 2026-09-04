# Offene Punkte

*Notiert am 26.08.2026 fuer spaetere Sitzungen. Erledigte Punkte bitte streichen,
nicht abhaken — die Datei soll kurz bleiben.*


## Perspektivisch: fuer Nachnutzung abstrahieren

Benedict, 04.09.2026: Die Baumkarte soll irgendwann nicht mehr nur Moosburg
zeigen, sondern von anderen Kommunen mit eigenen Daten genutzt werden koennen.

Damit gehoert dieses Repo in die dritte Namensklasse aus `moosburg-eu/UMBAU.md`,
also **kein `moosburg-`-Praefix**, anders als bei den uebrigen Moosburger
Anwendungen. Der Name bleibt vorerst `baumkarte`.

Was dafuer aus dem Code muss, ist noch nicht durchgesehen. Sichtbare Kandidaten:
der Mittelpunkt `CLAT, CLON` und die beiden Bounding-Boxen in
`etl/fetch_umwelt.py`, der Gebietsschluessel 124018, und die Kachel-Erzeugung in
`etl/build_tiles.py`. Vermutlich laeuft es auf eine Konfigurationsdatei je
Kommune hinaus, wie beim Sitzungswerkzeug.

## Toolchain-Stand

Dieses Repo laeuft seit dem 26.08.2026 auf **pnpm** (nicht npm) und auf der
projektweiten Hausbasis. **Die Zielversionen stehen nicht hier**, sondern in
`hausbasis/baseline.json` — eine Quelle statt einer Tabelle je Repo. Abgleich:

```bash
node ../hausbasis/check.mjs --kurz
```

Der Sinn ist Deduplizierung: alle Repos teilen sich einen pnpm-Store, der genau so
weit dedupliziert, wie die Versionen uebereinstimmen. Gemessen kostet ein Repo mit
abweichenden Versionen ~158 MB, ein Versions-Zwilling ~8 MB. **Einzelne Pakete
also nicht im Alleingang hochziehen** — das faellt allen anderen Repos zur Last.

## Warum `baseUrl` aus der tsconfig verschwunden ist

TypeScript 7 hat die Option entfernt (Fehler TS5102). Die Zeile
`"baseUrl": "."` wurde ersatzlos gestrichen — `paths` loest TS 7 relativ zur
tsconfig-Datei auf, die Eintraege stimmen unveraendert weiter. **Nicht
"reparieren", indem `baseUrl` wieder eingetragen wird.**

## Zweiter Build nicht vergessen

Neben `pnpm run build` gibt es `build:hostinger` mit abweichendem `--base`.
Beide muessen nach einem Update gruen sein; die CI baut beide.

## Beim naechsten Paket-Update

Weder `pnpm install` noch `pnpm prune` raeumt die alte Version aus
`node_modules/.pnpm`. Nach einem Upgrade deshalb:

```bash
rm -rf node_modules && pnpm install
pnpm store prune
```

Ohne diesen Schritt bleibt der Speichergewinn auf dem Papier. In den beiden
Upgrade-Wellen am 26.08.2026 hat das zusammen ~1,2 GB freigegeben.

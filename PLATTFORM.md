# Plattform-Kontext

Wo diese App läuft und was beim Ändern zu beachten ist. Der übergreifende
Kontext steht im Repo `bagruber/moosburg-eu` in `BRIEFING.md`.

*Stand: September 2026*

---

## Zwei Adressen, zwei Builds, ein Branch

| | Adresse | Basispfad | Build |
|---|---|---|---|
| GitHub Pages | `bagruber.github.io/baumkarte/` | `/baumkarte/` | `pnpm build` (`.github/workflows/pages.yml`) |
| moosburg.eu | `moosburg.eu/data/baumkarte/` | `/data/baumkarte/` | `pnpm build:hostinger` (`moosburg-eu.yml`) |

Der Basispfad für moosburg.eu steht **nicht** in `vite.config.ts`, sondern im
Script-Eintrag `build:hostinger` als `--base=/data/baumkarte/`. Eine Änderung an
`base` in der Config bräche immer eine der beiden Varianten.

Die App liegt auf moosburg.eu unterhalb von `/data/`, wo `datahub` die Wurzel
belegt. Dessen Deploy überträgt nur geänderte Dateien und löscht nichts, deshalb
stören sich die beiden nicht. Wer dort je `dangerous-clean-slate` aktiviert,
löscht diese App mit.

## Der Deploy braucht mehr Zeit als die Geschwister

`timeout: 300000` statt der sonst üblichen 120 s. Grund sind die rund 52 MB
Kacheln und das gemeinsame FTP-Konto: läuft parallel ein anderer Deploy, nimmt
Hostinger die Verbindung erst nach Minuten an, und der Lauf endete genau daran
schon einmal mit `Timeout (control socket)`.

## Der tägliche Cron committet auf main

`umwelt.yml` läuft um 6:20 Uhr, holt die Umweltdaten und committet sie als
`github-actions[bot]` nach `main`. **Vor jedem Push erst pullen**, sonst steht
der eigene Commit hinter einem fremden.

Der Lauf baut und veröffentlicht danach selbst, aber **nur nach GitHub Pages**.
Ein Push mit dem `GITHUB_TOKEN` löst keine weiteren Workflows aus, also startet
er `moosburg-eu.yml` nicht mit. Auf moosburg.eu steht die Umweltlage deshalb so
lange still, bis dort jemand von Hand deployt oder ohnehin etwas pusht.

## Offen: Zählung einbinden

Die Zeile `<script src="/assets/zaehler.js" defer></script>` fehlt noch vor
`</body>` in `index.html`, mit absolutem Pfad. Die App hat nur eine Ansicht, der
Aufruf beim Laden genügt, ein Routenwechsel ist nicht zu melden. Auf GitHub
Pages läuft der Aufruf absichtlich ins Leere, damit die Pages-Zwillinge die
Zahlen nicht verdoppeln.

Warum die Zählung ohne Einwilligungsbanner auskommt, und warum deshalb hier
niemals eine Sitzungs-ID in `sessionStorage` oder `localStorage` nachgerüstet
werden darf, steht in `bagruber/moosburg-eu`, `README.md`, Abschnitt „Zählen".

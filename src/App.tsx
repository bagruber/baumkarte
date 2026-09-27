import { useCallback, useEffect, useState, type CSSProperties } from "react";
import { TreeMap, type Grundkarte } from "./components/TreeMap";
import { Plate } from "./components/Plate";
import { Kopf, PanelInhalt } from "./components/Kopf";
import { Laden } from "./components/Laden";
import { HEIGHT_MIN } from "./lib/ramp";
import {
  ladeUmwelt,
  ladeZellen,
  type Ausschnitt,
  type Flaeche,
  type Umwelt,
  type Zelle,
} from "./lib/umwelt";

const TREE_COUNT = 2_868_813;

/** Hoehe des Blatts am Telefon. In Ruhe genau das Instrument, aufgezogen der
 *  Rest. Feste Werte, damit das Aufklappen der Erlaeuterung nichts verschiebt. */
const BLATT_RUHE = "10rem";
const BLATT_AUF = "62dvh";

export default function App() {
  const [minHeight, setMinHeight] = useState(HEIGHT_MIN);
  const [flaeche, setFlaeche] = useState<Flaeche>("aus");
  const [umwelt, setUmwelt] = useState<Umwelt | null>(null);
  const [zellen, setZellen] = useState<Zelle[]>([]);
  const [tageWasser, setTageWasser] = useState<string[]>([]);
  const [ausschnitt, setAusschnitt] = useState<Ausschnitt | null>(null);
  const [grundkarte, setGrundkarte] = useState<Grundkarte>("basemap");
  const [karteSteht, setKarteSteht] = useState(false);
  const [aufgezogen, setAufgezogen] = useState(false);
  // Grosser Startwert: bis die Daten da sind, zeigt alles den neuesten Tag
  const [tagIndex, setTagIndex] = useState(999);

  useEffect(() => {
    let cancelled = false;
    ladeUmwelt().then((d) => {
      if (cancelled) return;
      setUmwelt(d);
      if (d?.duerre) setTagIndex(d.duerre.serie.length - 1);
    });
    ladeZellen().then(({ zellen, tageWasser }) => {
      if (cancelled) return;
      setZellen(zellen);
      setTageWasser(tageWasser);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const onBounds = useCallback((b: Ausschnitt) => setAusschnitt(b), []);
  const onBereit = useCallback(() => setKarteSteht(true), []);

  return (
    <div
      className="flex h-dvh flex-col"
      style={{ "--blatt-hoehe": aufgezogen ? BLATT_AUF : BLATT_RUHE } as CSSProperties}
    >
      <Kopf
        titel="Baumkarte"
        zahl={TREE_COUNT.toLocaleString("de-DE")}
        einheit="Einzelbäume"
        zeigeKennzahl={karteSteht}
        panel={
          <PanelInhalt
            name="Baumkarte Moosburg"
            satz="Jeder Punkt ein Baum, gefärbt nach seiner Höhe, dazu der Zustand des Bodens im Ausschnitt."
            repo="https://github.com/bagruber/baumkarte"
          />
        }
      />

      <div className="relative min-h-0 flex-1 lg:flex">
        <Plate
          minHeight={minHeight}
          onMinHeightChange={setMinHeight}
          umwelt={umwelt}
          zellen={zellen}
          tageWasser={tageWasser}
          ausschnitt={ausschnitt}
          tagIndex={tagIndex}
          onTagChange={setTagIndex}
          flaeche={flaeche}
          onFlaecheChange={setFlaeche}
          grundkarte={grundkarte}
          aufgezogen={aufgezogen}
          onAufgezogen={setAufgezogen}
        />
        <div className="relative h-full lg:flex-1">
          <TreeMap
            minHeight={minHeight}
            flaeche={flaeche}
            tagIndex={tagIndex}
            onBoundsChange={onBounds}
            onGrundkarte={setGrundkarte}
            onBereit={onBereit}
          />
          {!karteSteht && <Laden />}
        </div>
      </div>
    </div>
  );
}

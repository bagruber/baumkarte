import { useEffect, useState } from "react";
import { TreeMap } from "./components/TreeMap";
import { Plate } from "./components/Plate";
import { HEIGHT_MIN } from "./lib/ramp";
import { ladeUmwelt, type Umwelt } from "./lib/umwelt";

export default function App() {
  const [minHeight, setMinHeight] = useState(HEIGHT_MIN);
  const [showDuerre, setShowDuerre] = useState(false);
  const [umwelt, setUmwelt] = useState<Umwelt | null>(null);
  // Grosser Startwert: bis die Daten da sind, zeigt alles den neuesten Tag
  const [tagIndex, setTagIndex] = useState(999);

  useEffect(() => {
    let cancelled = false;
    ladeUmwelt().then((d) => {
      if (cancelled) return;
      setUmwelt(d);
      if (d?.duerre) setTagIndex(d.duerre.serie.length - 1);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="relative h-dvh">
      <TreeMap minHeight={minHeight} showDuerre={showDuerre} tagIndex={tagIndex} />
      <Plate
        minHeight={minHeight}
        onMinHeightChange={setMinHeight}
        umwelt={umwelt}
        tagIndex={tagIndex}
        onTagChange={setTagIndex}
        showDuerre={showDuerre}
        onToggleDuerre={setShowDuerre}
      />
    </div>
  );
}

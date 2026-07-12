import { useState } from "react";
import { TreeMap } from "./components/TreeMap";
import { Legend } from "./components/Legend";
import { InfoPanel } from "./components/InfoPanel";
import { HEIGHT_MIN } from "./lib/ramp";

export default function App() {
  const [showInfo, setShowInfo] = useState(false);
  const [minHeight, setMinHeight] = useState(HEIGHT_MIN);

  return (
    <div className="flex h-dvh flex-col">
      <header className="z-10 border-b border-ink-line bg-cream">
        <div className="flex items-center justify-between gap-3 px-3 py-2 sm:px-5">
          <div className="flex items-center gap-2.5">
            <img
              src={`${import.meta.env.BASE_URL}logo.svg`}
              alt=""
              aria-hidden
              className="h-8 w-8 sm:h-9 sm:w-9"
            />
            <div className="leading-tight">
              <h1 className="headline text-[1.05rem] sm:text-[1.2rem]">Baumkarte</h1>
              <p className="eyebrow">Moosburg – Landshut</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <p className="hidden text-sm text-ink-muted sm:block">
              2.868.813 Bäume aus amtlichen Geodaten
            </p>
            <button
              onClick={() => setShowInfo(true)}
              className="rounded-md border border-ink-line bg-cream px-3 py-1.5 text-sm font-semibold text-ink-soft shadow-soft hover:bg-cream-dark hover:text-ink"
            >
              Info
            </button>
          </div>
        </div>
      </header>

      <main className="relative flex-1">
        <TreeMap minHeight={minHeight} />
        <Legend minHeight={minHeight} onMinHeightChange={setMinHeight} />
        {showInfo && <InfoPanel onClose={() => setShowInfo(false)} />}
      </main>
    </div>
  );
}

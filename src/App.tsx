import { useState } from "react";
import { TreeMap } from "./components/TreeMap";
import { Plate } from "./components/Plate";
import { HEIGHT_MIN } from "./lib/ramp";

export default function App() {
  const [minHeight, setMinHeight] = useState(HEIGHT_MIN);

  return (
    <div className="relative h-dvh">
      <TreeMap minHeight={minHeight} />
      <Plate minHeight={minHeight} onMinHeightChange={setMinHeight} />
    </div>
  );
}

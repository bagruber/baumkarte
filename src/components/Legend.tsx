import { HEIGHT_MAX, HEIGHT_MIN, rampGradient } from "@/lib/ramp";

export function Legend({
  minHeight,
  onMinHeightChange,
}: {
  minHeight: number;
  onMinHeightChange: (v: number) => void;
}) {
  const filtered = minHeight > HEIGHT_MIN;
  return (
    <div className="absolute bottom-8 left-2 z-10 rounded-lg border border-ink-line bg-cream/95 px-3 py-2 shadow-soft backdrop-blur-sm">
      <p className="eyebrow mb-1">Baumhöhe</p>
      <div
        className="h-2 w-36 rounded-full sm:w-44"
        style={{ background: rampGradient }}
        role="img"
        aria-label={`Farbskala von ${HEIGHT_MIN} bis ${HEIGHT_MAX} Meter Baumhöhe`}
      />
      <div className="mt-0.5 flex justify-between text-[0.65rem] text-ink-muted">
        <span>{HEIGHT_MIN}&thinsp;m</span>
        <span>{(HEIGHT_MIN + HEIGHT_MAX) / 2}&thinsp;m</span>
        <span>{HEIGHT_MAX}&thinsp;m</span>
      </div>
      <div className="mt-2 border-t border-ink-line pt-1.5">
        <div className="flex items-baseline justify-between gap-2">
          <label htmlFor="min-height" className="text-[0.7rem] font-semibold text-ink-soft">
            Mindesthöhe
          </label>
          <span className="text-[0.7rem] tabular-nums text-ink-muted">
            {filtered ? `ab ${minHeight} m` : "alle Bäume"}
          </span>
        </div>
        <input
          id="min-height"
          type="range"
          min={HEIGHT_MIN}
          max={40}
          step={1}
          value={minHeight}
          onChange={(e) => onMinHeightChange(Number(e.target.value))}
          className="block h-4 w-full cursor-pointer"
          style={{ accentColor: "#266a31" }}
        />
      </div>
    </div>
  );
}

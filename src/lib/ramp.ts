/** Sequenzielle Gruen-Rampe fuer Baumhoehen (m). Ein Farbton, hell -> dunkel;
 * Startwert gewaehlt fuer >= 3:1 Kontrast auf heller Basiskarte. */
export const HEIGHT_STOPS: [number, string][] = [
  [5, "#639436"],
  [15, "#3f7d31"],
  [25, "#266a31"],
  [35, "#14522a"],
  [45, "#0b3d20"],
];

export const HEIGHT_MIN = HEIGHT_STOPS[0][0];
export const HEIGHT_MAX = HEIGHT_STOPS[HEIGHT_STOPS.length - 1][0];

/** CSS-Gradient fuer die Legende, Stops proportional zur Hoehenskala. */
export const rampGradient = `linear-gradient(to right, ${HEIGHT_STOPS.map(
  ([h, c]) => `${c} ${(((h - HEIGHT_MIN) / (HEIGHT_MAX - HEIGHT_MIN)) * 100).toFixed(0)}%`,
).join(", ")})`;

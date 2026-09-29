/** Client-safe chart range helpers (no server-only imports). */

export type ChartRangeKey = "1d" | "1w" | "1m" | "ytd" | "all";

export type RangeBar = { date: string; close: number };

/** Slice daily bars down to the selected chart range. */
export function filterBarsToRange<T extends { date: string }>(
  bars: T[],
  range: ChartRangeKey
): T[] {
  if (bars.length === 0 || range === "all" || range === "1d") return bars;

  const last = bars[bars.length - 1]?.date?.slice(0, 10);
  if (!last) return bars;
  const end = new Date(`${last}T00:00:00Z`);
  let start = new Date(end);

  if (range === "1w") start.setUTCDate(start.getUTCDate() - 7);
  else if (range === "1m") start.setUTCMonth(start.getUTCMonth() - 1);
  else if (range === "ytd") {
    start = new Date(Date.UTC(end.getUTCFullYear(), 0, 1));
  } else return bars;

  const startStr = start.toISOString().slice(0, 10);
  const filtered = bars.filter((b) => b.date.slice(0, 10) >= startStr);
  return filtered.length > 0 ? filtered : bars;
}

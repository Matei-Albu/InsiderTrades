export const CHART_RANGES = [
  { key: "1d", label: "1D" },
  { key: "1w", label: "1W" },
  { key: "1m", label: "1M" },
  { key: "ytd", label: "YTD" },
  { key: "all", label: "ALL" },
] as const;

export type ChartRange = (typeof CHART_RANGES)[number]["key"];
export const DEFAULT_CHART_RANGE: ChartRange = "all";

export function parseChartRange(
  value: string | string[] | undefined,
  fallback: ChartRange = DEFAULT_CHART_RANGE
): ChartRange {
  const raw = Array.isArray(value) ? value[0] : value;
  return CHART_RANGES.some((r) => r.key === raw)
    ? (raw as ChartRange)
    : fallback;
}

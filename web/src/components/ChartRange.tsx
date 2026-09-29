import Link from "next/link";

export const CHART_RANGES = [
  { key: "1d", label: "1D" },
  { key: "1w", label: "1W" },
  { key: "1m", label: "1M" },
  { key: "ytd", label: "YTD" },
  { key: "all", label: "ALL" },
] as const;

export type ChartRange = (typeof CHART_RANGES)[number]["key"];
export const DEFAULT_CHART_RANGE: ChartRange = "1m";

export function parseChartRange(
  value: string | string[] | undefined,
  fallback: ChartRange = DEFAULT_CHART_RANGE
): ChartRange {
  const raw = Array.isArray(value) ? value[0] : value;
  return CHART_RANGES.some((r) => r.key === raw)
    ? (raw as ChartRange)
    : fallback;
}

/** Range control for stock price charts (styled like ResultsLimit). */
export default function ChartRange({
  current,
  buildHref,
}: {
  current: ChartRange;
  buildHref: (range: ChartRange) => string;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs uppercase tracking-wide text-muted">Range</span>
      <div className="flex rounded-lg border border-border bg-surface p-0.5">
        {CHART_RANGES.map((r) => (
          <Link
            key={r.key}
            href={buildHref(r.key)}
            scroll={false}
            className={`rounded-md px-2.5 py-1 text-xs transition-colors ${
              current === r.key
                ? "bg-surface-2 font-medium text-foreground"
                : "text-muted hover:text-foreground"
            }`}
          >
            {r.label}
          </Link>
        ))}
      </div>
    </div>
  );
}

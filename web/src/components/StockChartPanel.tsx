"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import {
  CHART_RANGES,
  DEFAULT_CHART_RANGE,
  type ChartRange,
} from "@/components/ChartRange";
import PriceChart, { type ChartBar, type ChartMarker } from "@/components/PriceChart";
import TradeMarkerLegend, {
  type TradeMarkerItem,
} from "@/components/TradeMarkerLegend";
import { filterBarsToRange } from "@/lib/prices/range";

/** When Yahoo intraday fails, show the last few daily closes so 1D isn't blank. */
function dailyFallback(allBars: ChartBar[]): ChartBar[] {
  if (allBars.length === 0) return [];
  return allBars.slice(-5);
}

export default function StockChartPanel({
  ticker,
  allBars,
  markers,
  legendItems,
}: {
  ticker: string;
  allBars: ChartBar[];
  markers: ChartMarker[];
  legendItems: TradeMarkerItem[];
}) {
  const [range, setRange] = useState<ChartRange>(DEFAULT_CHART_RANGE);
  const [intraday, setIntraday] = useState<ChartBar[] | null>(null);
  const [intradayDone, setIntradayDone] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (range !== "1d") {
      setIntraday(null);
      setIntradayDone(false);
      return;
    }

    let cancelled = false;
    setIntraday(null);
    setIntradayDone(false);

    fetch(`/api/prices/${encodeURIComponent(ticker)}?range=1d`)
      .then(async (res) => {
        if (!res.ok) throw new Error("failed");
        return (await res.json()) as ChartBar[];
      })
      .then((bars) => {
        if (cancelled) return;
        setIntraday(Array.isArray(bars) && bars.length > 0 ? bars : null);
        setIntradayDone(true);
      })
      .catch(() => {
        if (cancelled) return;
        setIntraday(null);
        setIntradayDone(true);
      });

    return () => {
      cancelled = true;
    };
  }, [range, ticker]);

  const bars = useMemo(() => {
    if (range !== "1d") return filterBarsToRange(allBars, range);
    if (intraday && intraday.length > 0) return intraday;
    if (intradayDone) return dailyFallback(allBars);
    return [];
  }, [range, allBars, intraday, intradayDone]);

  const loading1d = range === "1d" && !intradayDone;
  const usingDailyFallback =
    range === "1d" && intradayDone && !(intraday && intraday.length > 0);

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        {usingDailyFallback ? (
          <span className="text-[11px] text-muted">
            Intraday feed unavailable — showing recent daily closes
          </span>
        ) : (
          <span />
        )}
        <div className="flex items-center gap-2">
          <span className="text-xs uppercase tracking-wide text-muted">Range</span>
          <div className="flex rounded-lg border border-border bg-surface p-0.5">
            {CHART_RANGES.map((r) => (
              <button
                key={r.key}
                type="button"
                onClick={() => startTransition(() => setRange(r.key))}
                className={`rounded-md px-2.5 py-1 text-xs transition-colors ${
                  range === r.key
                    ? "bg-surface-2 font-medium text-foreground"
                    : "text-muted hover:text-foreground"
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className={pending || loading1d ? "opacity-60 transition-opacity" : ""}>
        <PriceChart
          key={`${ticker}-${range}-${bars.length}-${usingDailyFallback}`}
          ticker={ticker}
          bars={bars}
          markers={markers}
        />
      </div>

      <TradeMarkerLegend items={legendItems} />
      <div className="mt-2 flex gap-4 text-xs text-muted">
        <span>
          <span className="inline-block h-2 w-2 rounded-full bg-gain" /> insider buy
        </span>
        <span>
          <span className="inline-block h-2 w-2 rounded-full bg-loss" /> insider sell
        </span>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useRef } from "react";
import {
  AreaSeries,
  ColorType,
  createChart,
  createSeriesMarkers,
  type SeriesMarker,
  type Time,
  type UTCTimestamp,
} from "lightweight-charts";

export type ChartBar = { date: string; close: number };
export type ChartMarker = {
  date: string;
  side: "buy" | "sell";
  label: string;
};

function toTime(date: string): UTCTimestamp {
  return (Date.parse(date + "T00:00:00Z") / 1000) as UTCTimestamp;
}

/** One dot per day per side — no labels on the chart. */
function aggregateMarkers(
  markers: ChartMarker[]
): { date: string; side: "buy" | "sell" }[] {
  const seen = new Set<string>();
  const out: { date: string; side: "buy" | "sell" }[] = [];
  for (const m of markers) {
    const key = `${m.date}:${m.side}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ date: m.date, side: m.side });
  }
  return out;
}

export default function PriceChart({
  ticker,
  bars,
  markers,
}: {
  ticker: string;
  bars: ChartBar[];
  markers: ChartMarker[];
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const hasData = bars.length > 0;

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !hasData) return;

    container.replaceChildren();

    // Determine if price went up or down overall for area fill color.
    const firstClose = bars[0].close;
    const lastClose = bars[bars.length - 1].close;
    const isUp = lastClose >= firstClose;
    const lineColor = isUp ? "#16a34a" : "#dc2626";
    const topColor = isUp ? "rgba(22, 163, 74, 0.15)" : "rgba(220, 38, 38, 0.15)";

    const chart = createChart(container, {
      height: 360,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#6b7280",
        attributionLogo: false,
      },
      grid: {
        vertLines: { color: "#f0f1f4" },
        horzLines: { color: "#f0f1f4" },
      },
      rightPriceScale: { borderColor: "#e2e4e9" },
      timeScale: {
        borderColor: "#e2e4e9",
        fixLeftEdge: true,
        fixRightEdge: true,
      },
      autoSize: true,
    });

    const series = chart.addSeries(AreaSeries, {
      lineColor,
      topColor,
      bottomColor: "transparent",
      lineWidth: 2,
    });
    series.setData(bars.map((b) => ({ time: toTime(b.date), value: b.close })));

    const first = toTime(bars[0].date);
    const last = toTime(bars[bars.length - 1].date);
    const seriesMarkers: SeriesMarker<Time>[] = aggregateMarkers(markers)
      .map((m) => ({ ...m, time: toTime(m.date) }))
      .filter((m) => m.time >= first && m.time <= last)
      .sort((a, b) => (a.time as number) - (b.time as number))
      .map((m) => ({
        time: m.time,
        position: m.side === "buy" ? ("belowBar" as const) : ("aboveBar" as const),
        color: m.side === "buy" ? "#16a34a" : "#dc2626",
        shape: "circle" as const,
        size: 1,
      }));
    createSeriesMarkers(series, seriesMarkers);

    chart.timeScale().fitContent();
    return () => {
      chart.remove();
      container.replaceChildren();
    };
  }, [ticker, bars, markers, hasData]);

  return (
    <div className="relative h-[360px] w-full">
      <div ref={containerRef} className="h-full w-full" />
      {!hasData && (
        <div className="absolute inset-0 flex items-center justify-center rounded-xl text-sm text-muted">
          Price data unavailable for this ticker
        </div>
      )}
    </div>
  );
}

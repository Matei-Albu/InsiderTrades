"use client";

import { useEffect, useRef } from "react";
import {
  AreaSeries,
  ColorType,
  createChart,
  createSeriesMarkers,
  type IChartApi,
  type ISeriesApi,
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
  const iso = date.includes("T") ? date : `${date}T00:00:00Z`;
  return (Date.parse(iso) / 1000) as UTCTimestamp;
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

function formatPct(pct: number): string {
  const sign = pct > 0 ? "+" : "";
  const abs = Math.abs(pct);
  const digits = abs >= 100 ? 0 : abs >= 10 ? 1 : 2;
  return `${sign}${pct.toFixed(digits)}%`;
}

/** Leftmost fully/partially visible bar index for the current zoom window. */
function leftmostVisibleIndex(
  chart: IChartApi,
  dataLength: number
): number | null {
  const range = chart.timeScale().getVisibleLogicalRange();
  if (!range || dataLength === 0) return null;
  const idx = Math.max(0, Math.min(dataLength - 1, Math.ceil(range.from)));
  return idx;
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
  const pctRef = useRef<HTMLDivElement>(null);
  const hasData = bars.length > 0;

  useEffect(() => {
    const container = containerRef.current;
    const pctEl = pctRef.current;
    if (!container || !pctEl || !hasData) return;

    container.replaceChildren();
    pctEl.style.display = "none";

    const firstClose = bars[0].close;
    const lastClose = bars[bars.length - 1].close;
    const isUp = lastClose >= firstClose;
    const lineColor = isUp ? "#0b7a53" : "#c23b32";
    const topColor = isUp ? "rgba(11, 122, 83, 0.15)" : "rgba(194, 59, 50, 0.15)";

    const chart = createChart(container, {
      height: 360,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#586377",
        attributionLogo: false,
      },
      grid: {
        vertLines: { color: "#e7ebf2" },
        horzLines: { color: "#e7ebf2" },
      },
      crosshair: {
        vertLine: {
          labelVisible: true,
        },
        horzLine: {
          labelVisible: true,
        },
      },
      rightPriceScale: { borderColor: "#d9dee7" },
      timeScale: {
        borderColor: "#d9dee7",
        fixLeftEdge: true,
        fixRightEdge: true,
      },
      autoSize: true,
    });

    const series: ISeriesApi<"Area"> = chart.addSeries(AreaSeries, {
      lineColor,
      topColor,
      bottomColor: "transparent",
      lineWidth: 2,
    });
    const data = bars
      .map((b) => ({
        time: toTime(b.date),
        value: Number(b.close),
      }))
      .filter(
        (b) =>
          Number.isFinite(b.time as number) &&
          Number.isFinite(b.value) &&
          (b.time as number) > 0
      )
      .sort((a, b) => (a.time as number) - (b.time as number));

    // Drop duplicate timestamps (lightweight-charts requires strictly ascending times).
    const deduped: typeof data = [];
    for (const point of data) {
      const prev = deduped[deduped.length - 1];
      if (prev && prev.time === point.time) {
        prev.value = point.value;
      } else {
        deduped.push(point);
      }
    }
    if (deduped.length === 0) {
      chart.remove();
      return;
    }
    series.setData(deduped);

    const first = deduped[0].time;
    const last = deduped[deduped.length - 1].time;
    const seriesMarkers: SeriesMarker<Time>[] = aggregateMarkers(markers)
      .map((m) => ({ ...m, time: toTime(m.date) }))
      .filter(
        (m) =>
          Number.isFinite(m.time as number) &&
          m.time >= first &&
          m.time <= last
      )
      .sort((a, b) => (a.time as number) - (b.time as number))
      .map((m) => ({
        time: m.time,
        position: m.side === "buy" ? ("belowBar" as const) : ("aboveBar" as const),
        color: m.side === "buy" ? "#0b7a53" : "#c23b32",
        shape: "circle" as const,
        size: 1,
      }));
    createSeriesMarkers(series, seriesMarkers);

    chart.timeScale().fitContent();

    const hidePct = () => {
      pctEl.style.display = "none";
    };

    const onCrosshair = (param: {
      time?: Time;
      point?: { x: number; y: number } | undefined;
      seriesData: Map<unknown, unknown>;
    }) => {
      if (
        param.time === undefined ||
        !param.point ||
        param.point.x < 0 ||
        param.point.y < 0
      ) {
        hidePct();
        return;
      }

      const leftIdx = leftmostVisibleIndex(chart, deduped.length);
      if (leftIdx == null) {
        hidePct();
        return;
      }
      const base = data[leftIdx]?.value;
      const hovered = param.seriesData.get(series) as
        | { value?: number }
        | undefined;
      const price = hovered?.value;
      if (base == null || base === 0 || price == null) {
        hidePct();
        return;
      }

      const pct = ((price - base) / base) * 100;
      const up = pct >= 0;
      pctEl.textContent = formatPct(pct);
      pctEl.style.color = up ? "#0b7a53" : "#c23b32";
      pctEl.style.backgroundColor = up
        ? "rgba(11, 122, 83, 0.12)"
        : "rgba(194, 59, 50, 0.12)";
      pctEl.style.borderColor = up
        ? "rgba(11, 122, 83, 0.35)"
        : "rgba(194, 59, 50, 0.35)";

      // Sit just left of the crosshair vertical, near the hover price.
      const labelW = pctEl.offsetWidth || 56;
      const x = Math.min(
        Math.max(8, param.point.x - labelW - 8),
        container.clientWidth - labelW - 8
      );
      const y = Math.min(
        Math.max(8, param.point.y - 14),
        container.clientHeight - 28
      );
      pctEl.style.transform = `translate(${x}px, ${y}px)`;
      pctEl.style.display = "block";
    };

    chart.subscribeCrosshairMove(onCrosshair);

    return () => {
      chart.unsubscribeCrosshairMove(onCrosshair);
      chart.remove();
      container.replaceChildren();
      hidePct();
    };
  }, [ticker, bars, markers, hasData]);

  return (
    <div className="relative h-[360px] w-full">
      <div ref={containerRef} className="h-full w-full" />
      <div
        ref={pctRef}
        className="pointer-events-none absolute left-0 top-0 z-10 hidden rounded border px-1.5 py-0.5 text-xs font-semibold tabular-nums shadow-sm backdrop-blur-sm"
        aria-hidden
      />
      {!hasData && (
        <div className="absolute inset-0 flex items-center justify-center rounded-lg text-sm text-muted-foreground">
          Price data unavailable for this ticker
        </div>
      )}
    </div>
  );
}

import type { PriceBar } from "@/lib/types";

type YahooChartResponse = {
  chart: {
    result?: Array<{
      timestamp: number[];
      indicators: {
        quote: Array<{
          open?: (number | null)[];
          high?: (number | null)[];
          low?: (number | null)[];
          close?: (number | null)[];
          volume?: (number | null)[];
        }>;
      };
    }>;
    error?: { description: string };
  };
};

/** Fetch 5 years of daily OHLC from Yahoo Finance (free, no API key). */
export async function fetchYahooPrices(ticker: string): Promise<PriceBar[]> {
  const symbol = ticker.toUpperCase();
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=5y&interval=1d&events=history`;

  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
    },
    next: { revalidate: 3600 }, // cache 1 hour per ticker
  });

  if (!res.ok) return [];
  const json = (await res.json()) as YahooChartResponse;
  if (json.chart.error) return [];

  const result = json.chart.result?.[0];
  const quote = result?.indicators.quote[0];
  if (!result || !quote) return [];

  const bars: PriceBar[] = [];
  for (let i = 0; i < result.timestamp.length; i++) {
    const close = quote.close?.[i];
    if (close == null) continue;
    bars.push({
      ticker: symbol,
      date: new Date(result.timestamp[i] * 1000).toISOString().slice(0, 10),
      open: quote.open?.[i] ?? null,
      high: quote.high?.[i] ?? null,
      low: quote.low?.[i] ?? null,
      close,
      volume: quote.volume?.[i] ?? null,
    });
  }
  return bars;
}

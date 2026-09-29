import type { PriceBar } from "@/lib/types";

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

type YahooChartResponse = {
  chart: {
    result?: Array<{
      timestamp: number[];
      meta?: {
        longName?: string;
        shortName?: string;
        regularMarketPrice?: number;
        chartPreviousClose?: number;
        fiftyTwoWeekHigh?: number;
        fiftyTwoWeekLow?: number;
        currency?: string;
      };
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

type YahooRawNumber = number | { raw?: number | null; fmt?: string } | null;

export type CompanyQuote = {
  name: string | null;
  description: string | null;
  sector: string | null;
  industry: string | null;
  website: string | null;
  marketCap: number | null;
  peRatio: number | null;
  forwardPE: number | null;
  eps: number | null;
  beta: number | null;
  dividendYield: number | null;
  fiftyTwoWeekHigh: number | null;
  fiftyTwoWeekLow: number | null;
  averageVolume: number | null;
  employees: number | null;
};

export type ChartRangeKey = "1d" | "1w" | "1m" | "ytd" | "all";

function rawNum(v: YahooRawNumber | undefined): number | null {
  if (v == null) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v.raw === "number" && Number.isFinite(v.raw)) return v.raw;
  return null;
}

function parseChartBars(
  symbol: string,
  json: YahooChartResponse,
  intraday: boolean
): PriceBar[] {
  if (json.chart.error) return [];
  const result = json.chart.result?.[0];
  const quote = result?.indicators.quote[0];
  if (!result?.timestamp || !quote) return [];

  const bars: PriceBar[] = [];
  for (let i = 0; i < result.timestamp.length; i++) {
    const close = quote.close?.[i];
    if (close == null) continue;
    const ts = result.timestamp[i] * 1000;
    bars.push({
      ticker: symbol,
      date: intraday
        ? new Date(ts).toISOString()
        : new Date(ts).toISOString().slice(0, 10),
      open: quote.open?.[i] ?? null,
      high: quote.high?.[i] ?? null,
      low: quote.low?.[i] ?? null,
      close,
      volume: quote.volume?.[i] ?? null,
    });
  }
  return bars;
}

async function yahooChart(
  symbol: string,
  params: string,
  revalidate: number
): Promise<YahooChartResponse | null> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?${params}`;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "application/json" },
      next: { revalidate },
    });
    if (!res.ok) return null;
    return (await res.json()) as YahooChartResponse;
  } catch {
    return null;
  }
}

/** Full daily history (up to 5y). Prefer this + local filtering over per-range Yahoo calls. */
export async function fetchYahooPrices(
  ticker: string,
  rangeKey: ChartRangeKey = "all"
): Promise<PriceBar[]> {
  const symbol = ticker.toUpperCase();

  if (rangeKey === "1d") {
    const json = await yahooChart(symbol, "range=1d&interval=5m", 300);
    if (!json) return [];
    return parseChartBars(symbol, json, true);
  }

  // Always request the long window; callers filter to 1w/1m/ytd.
  const json = await yahooChart(
    symbol,
    "range=5y&interval=1d&events=history",
    3600
  );
  if (!json) return [];
  return parseChartBars(symbol, json, false);
}

/** Slice daily bars down to the selected chart range. */
export function filterBarsToRange(
  bars: PriceBar[],
  range: ChartRangeKey
): PriceBar[] {
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
  // Never return empty if we have history — show whatever exists.
  return filtered.length > 0 ? filtered : bars;
}

type CrumbSession = { cookie: string; crumb: string; fetchedAt: number };
let crumbSession: CrumbSession | null = null;

function collectCookies(res: Response): string[] {
  const fromGetSet = res.headers.getSetCookie?.() ?? [];
  if (fromGetSet.length) return fromGetSet.map((c) => c.split(";")[0]).filter(Boolean);
  const single = res.headers.get("set-cookie");
  if (!single) return [];
  // Multiple cookies may be comma-joined in some runtimes; keep name=value pairs.
  return single
    .split(/,(?=\s*[^;=]+=)/)
    .map((c) => c.split(";")[0].trim())
    .filter(Boolean);
}

async function getYahooSession(): Promise<CrumbSession | null> {
  const now = Date.now();
  if (crumbSession && now - crumbSession.fetchedAt < 30 * 60 * 1000) {
    return crumbSession;
  }

  // Only use fc.yahoo.com → getcrumb. Fetching finance.yahoo.com/quote overflows
  // Node/undici header limits (UND_ERR_HEADERS_OVERFLOW) and breaks the About panel.
  const crumbHosts = [
    "query1.finance.yahoo.com",
    "query2.finance.yahoo.com",
  ];

  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const consent = await fetch("https://fc.yahoo.com", {
        headers: { "User-Agent": UA },
        redirect: "manual",
        cache: "no-store",
      });
      const cookie = collectCookies(consent).join("; ");
      if (!cookie) {
        await sleep(750 * (attempt + 1));
        continue;
      }

      for (const host of crumbHosts) {
        const crumbRes = await fetch(`https://${host}/v1/test/getcrumb`, {
          headers: { "User-Agent": UA, Cookie: cookie },
          cache: "no-store",
        });
        if (crumbRes.status === 429) continue;
        if (!crumbRes.ok) continue;
        const crumb = (await crumbRes.text()).trim();
        if (!crumb || crumb.length > 200 || crumb.includes("<")) continue;

        crumbSession = { cookie, crumb, fetchedAt: Date.now() };
        return crumbSession;
      }
      await sleep(1200 * (attempt + 1));
    } catch {
      await sleep(750 * (attempt + 1));
    }
  }
  return null;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

const emptyQuote = (): CompanyQuote => ({
  name: null,
  description: null,
  sector: null,
  industry: null,
  website: null,
  marketCap: null,
  peRatio: null,
  forwardPE: null,
  eps: null,
  beta: null,
  dividendYield: null,
  fiftyTwoWeekHigh: null,
  fiftyTwoWeekLow: null,
  averageVolume: null,
  employees: null,
});

/** Company description + key stats via Yahoo quoteSummary (crumb auth). */
export async function fetchYahooQuote(ticker: string): Promise<CompanyQuote> {
  const symbol = ticker.toUpperCase();
  const base = emptyQuote();

  const session = await getYahooSession();
  if (session) {
    const modules = [
      "assetProfile",
      "summaryDetail",
      "defaultKeyStatistics",
      "price",
    ].join(",");

    for (const host of [
      "query1.finance.yahoo.com",
      "query2.finance.yahoo.com",
    ]) {
      const url =
        `https://${host}/v10/finance/quoteSummary/${encodeURIComponent(symbol)}` +
        `?modules=${modules}&crumb=${encodeURIComponent(session.crumb)}`;
      try {
        const res = await fetch(url, {
          headers: {
            "User-Agent": UA,
            Cookie: session.cookie,
            Accept: "application/json",
          },
          next: { revalidate: 3600 },
        });

        if (res.status === 401 || res.status === 403) {
          crumbSession = null;
          continue;
        }
        if (!res.ok) continue;

        const text = await res.text();
        let json: {
          quoteSummary?: {
            result?: Array<{
              assetProfile?: {
                longBusinessSummary?: string;
                sector?: string;
                industry?: string;
                website?: string;
                fullTimeEmployees?: number;
              };
              summaryDetail?: Record<string, YahooRawNumber>;
              defaultKeyStatistics?: Record<string, YahooRawNumber>;
              price?: {
                longName?: string;
                shortName?: string;
                marketCap?: YahooRawNumber;
              };
            }>;
          };
        };
        try {
          json = JSON.parse(text);
        } catch {
          continue;
        }

        const result = json.quoteSummary?.result?.[0];
        if (!result) continue;

        const profile = result.assetProfile ?? {};
        const detail = result.summaryDetail ?? {};
        const stats = result.defaultKeyStatistics ?? {};
        const price = result.price ?? {};

        return {
          name: price.longName ?? price.shortName ?? null,
          description: profile.longBusinessSummary ?? null,
          sector: profile.sector ?? null,
          industry: profile.industry ?? null,
          website: profile.website ?? null,
          marketCap: rawNum(price.marketCap) ?? rawNum(detail.marketCap),
          peRatio: rawNum(detail.trailingPE) ?? rawNum(stats.trailingPE),
          forwardPE: rawNum(detail.forwardPE) ?? rawNum(stats.forwardPE),
          eps: rawNum(stats.trailingEps),
          beta: rawNum(stats.beta) ?? rawNum(detail.beta),
          dividendYield: rawNum(detail.dividendYield) ?? rawNum(detail.yield),
          fiftyTwoWeekHigh: rawNum(detail.fiftyTwoWeekHigh),
          fiftyTwoWeekLow: rawNum(detail.fiftyTwoWeekLow),
          averageVolume: rawNum(detail.averageVolume),
          employees: profile.fullTimeEmployees ?? null,
        };
      } catch {
        // try next host
      }
    }
  }

  return fetchQuoteFromChartMeta(symbol, base);
}

async function fetchQuoteFromChartMeta(
  symbol: string,
  base: CompanyQuote
): Promise<CompanyQuote> {
  try {
    const json = await yahooChart(symbol, "range=5d&interval=1d", 3600);
    const meta = json?.chart.result?.[0]?.meta;
    if (!meta) return base;
    return {
      ...base,
      name: meta.longName ?? meta.shortName ?? null,
      fiftyTwoWeekHigh: meta.fiftyTwoWeekHigh ?? null,
      fiftyTwoWeekLow: meta.fiftyTwoWeekLow ?? null,
    };
  } catch {
    return base;
  }
}

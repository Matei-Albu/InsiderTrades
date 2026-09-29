import Link from "next/link";
import { notFound } from "next/navigation";
import ChartRange, {
  DEFAULT_CHART_RANGE,
  parseChartRange,
  type ChartRange as ChartRangeKey,
} from "@/components/ChartRange";
import PriceChart, { type ChartMarker } from "@/components/PriceChart";
import TradesTable from "@/components/TradesTable";
import TradeMarkerLegend, { type TradeMarkerItem } from "@/components/TradeMarkerLegend";
import WatchButton from "@/components/WatchButton";
import { createClient } from "@/lib/supabase/server";
import {
  getCompanyQuote,
  getInstitutionalOwners,
  getPrices,
  getTrades,
  resolveCompany,
} from "@/lib/queries";
import {
  formatCompactNumber,
  formatMarketCap,
  formatMoney,
  formatPercent,
  formatPrice,
  formatRatio,
  formatShares,
} from "@/lib/format";

export const dynamic = "force-dynamic";

function rangeHref(ticker: string, range: ChartRangeKey) {
  const params = new URLSearchParams();
  if (range !== DEFAULT_CHART_RANGE) params.set("range", range);
  const qs = params.toString();
  return qs ? `/stocks/${ticker}?${qs}` : `/stocks/${ticker}`;
}

export default async function StockPage({
  params,
  searchParams,
}: PageProps<"/stocks/[ticker]">) {
  const { ticker: rawTicker } = await params;
  const ticker = decodeURIComponent(rawTicker).toUpperCase();
  const sp = await searchParams;
  const range = parseChartRange(sp.range);

  const company = await resolveCompany(ticker);
  if (!company) notFound();

  const supabase = await createClient();
  const [
    trades,
    prices,
    owners,
    quote,
    {
      data: { user },
    },
  ] = await Promise.all([
    getTrades({ side: "all", minValue: 0, ticker }, 50),
    getPrices(ticker, range),
    getInstitutionalOwners(ticker),
    getCompanyQuote(ticker),
    supabase.auth.getUser(),
  ]);

  let watching = false;
  if (user) {
    const { data } = await supabase
      .from("watchlists")
      .select("id")
      .eq("ticker", ticker)
      .maybeSingle();
    watching = !!data;
  }

  const markers: ChartMarker[] = trades
    .filter(
      (t) =>
        t.transaction_date &&
        (t.transaction_code === "P" || t.transaction_code === "S")
    )
    .map((t) => ({
      date: t.transaction_date!,
      side: t.transaction_code === "P" ? ("buy" as const) : ("sell" as const),
      label: `${t.insider_name.split(" ")[0]} ${formatMoney(t.total_value)}`,
    }));

  const markerLegend: TradeMarkerItem[] = trades
    .filter(
      (t) =>
        t.transaction_date &&
        (t.transaction_code === "P" || t.transaction_code === "S")
    )
    .map((t) => ({
      date: t.transaction_date!,
      side: t.transaction_code === "P" ? ("buy" as const) : ("sell" as const),
      insider: t.insider_name,
      value: t.total_value,
    }));

  const lastClose = prices.at(-1)?.close;
  const displayName = quote?.name ?? company.name;
  const sectorLine = [quote?.sector, quote?.industry].filter(Boolean).join(" · ");

  const stats: { label: string; value: string }[] = [
    { label: "Market cap", value: formatMarketCap(quote?.marketCap) },
    { label: "P/E", value: formatRatio(quote?.peRatio) },
    { label: "Forward P/E", value: formatRatio(quote?.forwardPE) },
    { label: "EPS", value: formatPrice(quote?.eps) },
    { label: "Beta", value: formatRatio(quote?.beta) },
    { label: "Div yield", value: formatPercent(quote?.dividendYield) },
    {
      label: "52W range",
      value:
        quote?.fiftyTwoWeekLow != null && quote?.fiftyTwoWeekHigh != null
          ? `${formatPrice(quote.fiftyTwoWeekLow)} – ${formatPrice(quote.fiftyTwoWeekHigh)}`
          : "—",
    },
    { label: "Avg volume", value: formatCompactNumber(quote?.averageVolume) },
    {
      label: "Employees",
      value: formatCompactNumber(quote?.employees ?? null),
    },
  ];
  const hasStats = stats.some((s) => s.value !== "—");
  const hasDescription = Boolean(quote?.description);
  const showAbout = hasDescription || hasStats;

  return (
    <div key={`${ticker}-${range}`} className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-mono text-2xl font-semibold tracking-tight">
              {ticker}
            </h1>
            {lastClose != null && (
              <span className="font-mono text-xl text-muted">
                ${lastClose.toFixed(2)}
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-muted">{displayName}</p>
          {sectorLine && (
            <p className="mt-0.5 text-xs text-muted">{sectorLine}</p>
          )}
        </div>
        <WatchButton ticker={ticker} initialWatching={watching} signedIn={!!user} />
      </div>

      {showAbout && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">About</h2>
          <div className="rounded-xl border border-border bg-surface p-4 sm:p-5">
            {hasDescription && (
              <p className="text-sm leading-relaxed text-muted">
                {quote!.description!.length > 520
                  ? `${quote!.description!.slice(0, 520).trim()}…`
                  : quote!.description}
                {quote?.website && (
                  <>
                    {" "}
                    <a
                      href={
                        quote.website.startsWith("http")
                          ? quote.website
                          : `https://${quote.website}`
                      }
                      target="_blank"
                      rel="noreferrer"
                      className="text-accent hover:underline"
                    >
                      Website
                    </a>
                  </>
                )}
              </p>
            )}
            {hasStats && (
              <dl
                className={`grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3 lg:grid-cols-4 ${
                  hasDescription ? "mt-4 border-t border-border pt-4" : ""
                }`}
              >
                {stats
                  .filter((s) => s.value !== "—")
                  .map((s) => (
                    <div key={s.label}>
                      <dt className="text-[11px] uppercase tracking-wide text-muted">
                        {s.label}
                      </dt>
                      <dd className="mt-0.5 font-mono text-sm font-medium tabular-nums">
                        {s.value}
                      </dd>
                    </div>
                  ))}
              </dl>
            )}
          </div>
        </section>
      )}

      <div className="rounded-xl border border-border bg-surface p-4">
        <div className="mb-3 flex justify-end">
          <ChartRange
            current={range}
            buildHref={(r) => rangeHref(ticker, r)}
          />
        </div>
        <PriceChart
          ticker={ticker}
          bars={prices
            .filter((p) => p.close != null)
            .map((p) => ({ date: p.date, close: p.close! }))}
          markers={markers}
        />
        <TradeMarkerLegend items={markerLegend} />
        <div className="mt-2 flex gap-4 text-xs text-muted">
          <span>
            <span className="inline-block h-2 w-2 rounded-full bg-gain" /> insider buy
          </span>
          <span>
            <span className="inline-block h-2 w-2 rounded-full bg-loss" /> insider sell
          </span>
        </div>
      </div>

      {owners.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Institutional owners</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {owners.map((o) => (
              <Link
                key={o.institution.cik}
                href={`/institutions/${o.institution.slug}`}
                className="rounded-lg border border-border bg-surface px-4 py-3 text-sm transition-colors hover:border-accent/50"
              >
                <div className="truncate font-medium">{o.institution.name}</div>
                <div className="mt-1 flex justify-between font-mono text-xs text-muted">
                  <span>{formatShares(o.shares)} sh</span>
                  <span>{formatMoney(o.value)}</span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Insider filing history</h2>
        <TradesTable trades={trades} />
      </section>
    </div>
  );
}

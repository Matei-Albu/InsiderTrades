import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import CompanyAbout from "@/components/CompanyAbout";
import { TickerLogo } from "@/components/media";
import PageHeader from "@/components/PageHeader";
import StockChartPanel from "@/components/StockChartPanel";
import TradesList from "@/components/TradesList";
import type { ChartMarker } from "@/components/PriceChart";
import type { TradeMarkerItem } from "@/components/TradeMarkerLegend";
import WatchButton from "@/components/WatchButton";
import {
  getClusterTickers,
  getInstitutionalOwners,
  getPrices,
  getTrades,
  getUserWatchlist,
  resolveCompany,
} from "@/lib/queries";
import { formatMoney, formatShares } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function StockPage({
  params,
}: PageProps<"/stocks/[ticker]">) {
  const { ticker: rawTicker } = await params;
  const ticker = decodeURIComponent(rawTicker).toUpperCase();

  const company = await resolveCompany(ticker);
  if (!company) notFound();

  // Load full history once; range switching is client-side (no Vercel round-trip).
  const [trades, prices, owners, clusterTickers, { user, watched }] =
    await Promise.all([
      getTrades({ side: "all", minValue: 0, ticker }, 50),
      getPrices(ticker, "all"),
      getInstitutionalOwners(ticker),
      getClusterTickers(),
      getUserWatchlist(),
    ]);

  const markerTrades = trades.filter(
    (t) =>
      t.transaction_date &&
      (t.transaction_code === "P" || t.transaction_code === "S")
  );

  const markers: ChartMarker[] = markerTrades.map((t) => ({
    date: t.transaction_date!,
    side: t.transaction_code === "P" ? ("buy" as const) : ("sell" as const),
    label: `${t.insider_name.split(" ")[0]} ${formatMoney(t.total_value)}`,
  }));

  const markerLegend: TradeMarkerItem[] = markerTrades.map((t) => ({
    date: t.transaction_date!,
    side: t.transaction_code === "P" ? ("buy" as const) : ("sell" as const),
    insider: t.insider_name,
    value: t.total_value,
  }));

  const allBars = prices
    .map((p) => ({
      date: String(p.date).slice(0, 10),
      close: Number(p.close),
    }))
    .filter((p) => Number.isFinite(p.close));
  const lastClose = allBars.at(-1)?.close;

  return (
    <main key={ticker}>
      <PageHeader
        eyebrow="Stock"
        title={ticker}
        description={company.name}
      >
        <div className="flex items-center gap-4">
          {lastClose != null && (
            <span className="font-mono text-2xl font-semibold tabular-nums">
              ${lastClose.toFixed(2)}
            </span>
          )}
          <WatchButton
            ticker={ticker}
            initialWatching={watched.has(ticker)}
            signedIn={!!user}
          />
        </div>
      </PageHeader>

      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-8 md:px-6">
        <Suspense fallback={null}>
          <CompanyAbout ticker={ticker} />
        </Suspense>

        <StockChartPanel
          key={ticker}
          ticker={ticker}
          allBars={allBars}
          markers={markers}
          legendItems={markerLegend}
        />

        {owners.length > 0 && (
          <section className="flex flex-col gap-4">
            <h2 className="text-lg font-semibold">Institutional owners</h2>
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {owners.map((o) => (
                <li key={o.institution.cik}>
                  <Link
                    href={`/institutions/${o.institution.slug}`}
                    className="flex items-center gap-3 rounded-lg border bg-card p-4 transition-colors hover:border-primary/50"
                  >
                    <TickerLogo symbol={null} name={o.institution.name} size="md" />
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="truncate text-sm font-semibold">
                        {o.institution.name}
                      </span>
                      <span className="flex justify-between font-mono text-xs text-muted-foreground">
                        <span>{formatShares(o.shares)} sh</span>
                        <span>{formatMoney(o.value)}</span>
                      </span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold">Insider filing history</h2>
          <TradesList
            trades={trades}
            clusterTickers={clusterTickers}
            watched={watched}
            signedIn={!!user}
            emptyMessage="No insider filings for this company yet."
          />
        </section>
      </div>
    </main>
  );
}

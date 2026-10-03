import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import CompanyAbout from "@/components/CompanyAbout";
import StockChartPanel from "@/components/StockChartPanel";
import TradesTable from "@/components/TradesTable";
import type { ChartMarker } from "@/components/PriceChart";
import type { TradeMarkerItem } from "@/components/TradeMarkerLegend";
import WatchButton from "@/components/WatchButton";
import { createClient } from "@/lib/supabase/server";
import {
  getInstitutionalOwners,
  getPrices,
  getTrades,
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

  const supabase = await createClient();
  // Load full history once; range switching is client-side (no Vercel round-trip).
  const [
    trades,
    prices,
    owners,
    {
      data: { user },
    },
  ] = await Promise.all([
    getTrades({ side: "all", minValue: 0, ticker }, 50),
    getPrices(ticker, "all"),
    getInstitutionalOwners(ticker),
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

  const allBars = prices
    .map((p) => ({
      date: String(p.date).slice(0, 10),
      close: Number(p.close),
    }))
    .filter((p) => Number.isFinite(p.close));
  const lastClose = allBars.at(-1)?.close;

  return (
    <div key={ticker} className="space-y-6">
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
          <p className="mt-1 text-sm text-muted">{company.name}</p>
        </div>
        <WatchButton ticker={ticker} initialWatching={watching} signedIn={!!user} />
      </div>

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

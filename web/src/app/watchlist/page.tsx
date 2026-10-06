import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import AddTickerForm from "@/components/AddTickerForm";
import { TickerLogo } from "@/components/media";
import PageHeader from "@/components/PageHeader";
import TradesList from "@/components/TradesList";
import WatchButton from "@/components/WatchButton";
import { getClusterTickers, getWatchlistActivity } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";
import type { InsiderTrade, WatchlistItem } from "@/lib/types";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Watchlist" };

const HEADER = {
  eyebrow: "Your names",
  title: "Watchlist",
  description:
    "Every insider filing for the tickers you follow, in one place. We email you a digest when insiders trade these stocks.",
} as const;

export default async function WatchlistPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // proxy.ts already redirects signed-out visitors; this is a safety net.
  if (!user) redirect("/login");

  const { data: items } = await supabase
    .from("watchlists")
    .select("id, ticker, created_at")
    .order("created_at", { ascending: false });
  const watchlist: WatchlistItem[] = items ?? [];
  const tickers = watchlist.map((w) => w.ticker);

  let trades: InsiderTrade[] = [];
  if (tickers.length > 0) {
    const { data } = await supabase
      .from("insider_trades")
      .select("*")
      .in("ticker", tickers)
      .order("filed_at", { ascending: false })
      .limit(100);
    trades = data ?? [];
  }
  const [clusterTickers, activity] = await Promise.all([
    getClusterTickers(),
    getWatchlistActivity(tickers),
  ]);

  const insiderCounts = new Map<string, number>();
  for (const t of trades) {
    if (t.ticker) insiderCounts.set(t.ticker, (insiderCounts.get(t.ticker) ?? 0) + 1);
  }

  return (
    <main>
      <PageHeader {...HEADER}>
        <AddTickerForm />
      </PageHeader>

      <div className="mx-auto flex max-w-6xl flex-col gap-10 px-4 py-8 md:px-6">
        <section aria-labelledby="tickers-heading" className="flex flex-col gap-4">
          <h2 id="tickers-heading" className="text-lg font-semibold">
            {watchlist.length} ticker{watchlist.length === 1 ? "" : "s"} watched
          </h2>

          {watchlist.length === 0 ? (
            <p className="rounded-lg border bg-card px-5 py-12 text-center text-sm text-muted-foreground">
              Your watchlist is empty. Add a ticker above or use the star on any
              filing to start tracking.
            </p>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {watchlist.map((w) => {
                const a = activity.get(w.ticker);
                return (
                  <li
                    key={w.id}
                    className="flex flex-col gap-4 rounded-lg border bg-card p-4"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-3">
                        <TickerLogo symbol={w.ticker} name={a?.company ?? w.ticker} />
                        <div className="flex min-w-0 flex-col">
                          <Link
                            href={`/stocks/${w.ticker}`}
                            className="font-mono font-semibold hover:underline"
                          >
                            {w.ticker}
                          </Link>
                          {a?.company && (
                            <span className="truncate text-xs text-muted-foreground">
                              {a.company}
                            </span>
                          )}
                        </div>
                      </div>
                      <WatchButton
                        variant="icon"
                        ticker={w.ticker}
                        initialWatching
                        signedIn
                      />
                    </div>
                    <dl className="grid grid-cols-3 gap-2 border-t pt-3 font-mono text-xs">
                      <div className="flex flex-col">
                        <dt className="text-muted-foreground">Insider</dt>
                        <dd className="font-semibold">{insiderCounts.get(w.ticker) ?? 0}</dd>
                      </div>
                      <div className="flex flex-col">
                        <dt className="text-muted-foreground">Congress</dt>
                        <dd className="font-semibold">{a?.congress ?? 0}</dd>
                      </div>
                      <div className="flex flex-col">
                        <dt className="text-muted-foreground">13F</dt>
                        <dd className="font-semibold">{a?.institutions ?? 0}</dd>
                      </div>
                    </dl>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {watchlist.length > 0 && (
          <section aria-labelledby="watch-feed-heading" className="flex flex-col gap-4">
            <h2 id="watch-feed-heading" className="text-lg font-semibold">
              Recent insider filings on your names
            </h2>
            <TradesList
              trades={trades}
              clusterTickers={clusterTickers}
              watched={new Set(tickers)}
              signedIn
              emptyMessage="No recent insider filings for your watched tickers."
            />
          </section>
        )}
      </div>
    </main>
  );
}

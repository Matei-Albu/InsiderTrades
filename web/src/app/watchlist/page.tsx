import { redirect } from "next/navigation";
import type { Metadata } from "next";
import TradesTable from "@/components/TradesTable";
import AddTickerForm from "@/components/AddTickerForm";
import WatchButton from "@/components/WatchButton";
import { createClient } from "@/lib/supabase/server";
import { getClusterTickers } from "@/lib/queries";
import type { InsiderTrade, WatchlistItem } from "@/lib/types";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Watchlist" };

export default async function WatchlistPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: items } = await supabase
    .from("watchlists")
    .select("id, ticker, created_at")
    .order("created_at", { ascending: false });
  const watchlist: WatchlistItem[] = items ?? [];

  let trades: InsiderTrade[] = [];
  if (watchlist.length > 0) {
    const { data } = await supabase
      .from("insider_trades")
      .select("*")
      .in(
        "ticker",
        watchlist.map((w) => w.ticker)
      )
      .order("filed_at", { ascending: false })
      .limit(100);
    trades = data ?? [];
  }
  const clusterTickers = await getClusterTickers();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Your watchlist</h1>
        <p className="mt-1 text-sm text-muted">
          You get an email digest when insiders trade these stocks.
        </p>
      </div>

      <AddTickerForm />

      {watchlist.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface p-10 text-center text-muted">
          Nothing watched yet. Add a ticker above or use the Watch button on any
          stock page.
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            {watchlist.map((w) => (
              <div
                key={w.id}
                className="flex items-center gap-2 rounded-lg border border-border bg-surface py-1 pl-3 pr-1"
              >
                <a
                  href={`/stocks/${w.ticker}`}
                  className="font-mono text-sm font-semibold text-accent hover:underline"
                >
                  {w.ticker}
                </a>
                <WatchButton ticker={w.ticker} initialWatching signedIn />
              </div>
            ))}
          </div>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Recent filings on watched stocks</h2>
            <TradesTable trades={trades} clusterTickers={clusterTickers} />
          </section>
        </>
      )}
    </div>
  );
}

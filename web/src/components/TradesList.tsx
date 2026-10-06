import InsiderTradeRow, { ROW_GRID } from "@/components/InsiderTradeRow";
import type { InsiderTrade } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Bordered card with a column header and one InsiderTradeRow per trade. */
export default function TradesList({
  trades,
  clusterTickers,
  watched,
  signedIn,
  emptyMessage = "No filings match these filters.",
}: {
  trades: InsiderTrade[];
  clusterTickers: Set<string>;
  watched: Set<string>;
  signedIn: boolean;
  emptyMessage?: string;
}) {
  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <div
        className={cn(
          "hidden gap-4 border-b bg-secondary/60 px-5 py-2.5 font-mono text-[11px] font-medium uppercase tracking-wider text-muted-foreground md:grid",
          ROW_GRID,
        )}
      >
        <span>Company</span>
        <span>Insider</span>
        <span>Transaction</span>
        <span className="text-right">Value · Filed</span>
        <span className="w-8" />
      </div>
      {trades.length > 0 ? (
        <ul className="divide-y">
          {trades.map((t) => (
            <InsiderTradeRow
              key={t.id}
              trade={t}
              isCluster={!!t.ticker && clusterTickers.has(t.ticker)}
              watching={!!t.ticker && watched.has(t.ticker)}
              signedIn={signedIn}
            />
          ))}
        </ul>
      ) : (
        <p className="px-5 py-12 text-center text-sm text-muted-foreground">
          {emptyMessage}
        </p>
      )}
    </div>
  );
}

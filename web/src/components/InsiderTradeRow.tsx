import Link from "next/link";
import type { InsiderTrade } from "@/lib/types";
import { formatDate, formatMoney, formatPrice, formatShares } from "@/lib/format";
import { PersonAvatar, TickerLogo, TradeTypeTag } from "@/components/media";
import WatchButton from "@/components/WatchButton";
import { cn } from "@/lib/utils";

function insiderRole(trade: InsiderTrade): { text: string; emphasised: boolean } | null {
  const title = trade.insider_title;
  if (title) {
    const isTopExec = /chief executive|chief financial|\bceo\b|\bcfo\b|president/i.test(title);
    return { text: title, emphasised: isTopExec };
  }
  if (trade.is_director) return { text: "Director", emphasised: false };
  if (trade.is_ten_percent_owner) return { text: "10% owner", emphasised: false };
  return null;
}

export const ROW_GRID =
  // Fixed widths for the last two columns: every row is its own grid, so `auto`
  // would size per row and make the columns drift out of alignment.
  "grid-cols-[auto_1fr_auto] md:grid-cols-[minmax(0,1.1fr)_minmax(0,1.3fr)_minmax(0,1fr)_13rem_2rem]";

export default function InsiderTradeRow({
  trade,
  isCluster,
  watching,
  signedIn,
}: {
  trade: InsiderTrade;
  isCluster: boolean;
  watching: boolean;
  signedIn: boolean;
}) {
  const isBuy = trade.transaction_code === "P";
  const isSell = trade.transaction_code === "S";
  const role = insiderRole(trade);
  const date = formatDate(trade.filed_at);

  return (
    <li
      className={cn(
        "grid items-center gap-x-4 gap-y-3 px-4 py-4 md:px-5",
        ROW_GRID,
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        <TickerLogo symbol={trade.ticker} name={trade.company_name} />
        <div className="flex min-w-0 flex-col">
          <div className="flex items-center gap-2">
            {trade.ticker ? (
              <Link
                href={`/stocks/${trade.ticker}`}
                className="font-mono text-sm font-semibold hover:underline"
              >
                {trade.ticker}
              </Link>
            ) : (
              <span className="font-mono text-sm font-semibold text-muted-foreground">—</span>
            )}
            {isCluster && (
              <span
                title="Multiple insiders bought within 14 days"
                className="rounded-sm bg-buy-soft px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-buy"
              >
                Cluster
              </span>
            )}
          </div>
          <span className="truncate text-xs text-muted-foreground">{trade.company_name}</span>
        </div>
      </div>

      <div className="col-span-2 row-start-2 flex min-w-0 items-center gap-3 md:col-span-1 md:row-start-auto">
        <PersonAvatar name={trade.insider_name} size="sm" />
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-sm font-medium">{trade.insider_name}</span>
          {role && (
            <span
              className={cn(
                "truncate text-xs",
                role.emphasised ? "font-medium text-primary" : "text-muted-foreground",
              )}
            >
              {role.text}
            </span>
          )}
        </div>
      </div>

      <div className="hidden flex-col gap-1 md:flex">
        <TradeTypeTag code={trade.transaction_code} className="self-start" />
        <span className="font-mono text-xs text-muted-foreground">
          {formatShares(trade.shares)} @ {formatPrice(trade.price_per_share)}
        </span>
      </div>

      <div className="flex flex-col items-end">
        <span
          className={cn(
            "font-mono text-base font-semibold tabular-nums",
            isBuy && "text-buy",
            isSell && "text-sell",
          )}
        >
          {isBuy ? "+" : isSell ? "−" : ""}
          {formatMoney(trade.total_value)}
        </span>
        <span className="font-mono text-xs text-muted-foreground">
          {isBuy && trade.pct_holdings_increase != null && (
            <>+{trade.pct_holdings_increase}% stake · </>
          )}
          {trade.source_url ? (
            <a
              href={trade.source_url}
              target="_blank"
              rel="noreferrer"
              title="View filing on SEC EDGAR"
              className="hover:text-foreground hover:underline"
            >
              {date}
            </a>
          ) : (
            date
          )}
        </span>
      </div>

      {trade.ticker ? (
        <WatchButton
          variant="icon"
          ticker={trade.ticker}
          initialWatching={watching}
          signedIn={signedIn}
          className="row-start-2 md:row-start-auto"
        />
      ) : (
        <span className="size-8" />
      )}
    </li>
  );
}

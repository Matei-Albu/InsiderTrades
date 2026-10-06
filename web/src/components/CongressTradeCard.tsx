import { Clock } from "lucide-react";
import Link from "next/link";
import { PartyTag, PersonAvatar, TickerLogo, TradeTypeTag } from "@/components/media";
import WatchButton from "@/components/WatchButton";
import { formatDate } from "@/lib/format";
import type { CongressTrade } from "@/lib/types";
import { cn } from "@/lib/utils";

const LATE_AFTER_DAYS = 30;

function lagDays(traded: string | null, filed: string): number | null {
  if (!traded) return null;
  const ms = new Date(filed).getTime() - new Date(traded).getTime();
  return Number.isNaN(ms) ? null : Math.max(0, Math.round(ms / 86_400_000));
}

export default function CongressTradeCard({
  trade: t,
  watching,
  signedIn,
}: {
  trade: CongressTrade;
  watching: boolean;
  signedIn: boolean;
}) {
  const lag = lagDays(t.transaction_date, t.filed_at);
  const late = lag != null && lag > LATE_AFTER_DAYS;
  const isBuy = t.transaction_type === "purchase";
  const isSell = t.transaction_type === "sale";

  return (
    <li className="flex flex-col gap-4 rounded-lg border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <PersonAvatar name={t.politician_name} size="lg" />
          <div className="flex min-w-0 flex-col gap-1">
            <span className="truncate font-semibold">{t.politician_name}</span>
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <PartyTag party={t.party} state={t.state} />
              <span className="truncate">{t.committees ?? t.chamber}</span>
            </span>
          </div>
        </div>
        {t.ticker && (
          <WatchButton
            variant="icon"
            ticker={t.ticker}
            initialWatching={watching}
            signedIn={signedIn}
          />
        )}
      </div>

      <div className="flex items-center justify-between gap-3 rounded-md bg-secondary/60 p-3">
        <div className="flex min-w-0 items-center gap-3">
          <TickerLogo symbol={t.ticker} name={t.asset_name} size="sm" />
          <div className="flex min-w-0 flex-col">
            {t.ticker ? (
              <Link
                href={`/stocks/${t.ticker}`}
                className="font-mono text-sm font-semibold hover:underline"
              >
                {t.ticker}
              </Link>
            ) : (
              <span className="font-mono text-sm font-semibold text-muted-foreground">—</span>
            )}
            <span className="truncate text-xs text-muted-foreground">{t.asset_name}</span>
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          {isBuy || isSell ? (
            <TradeTypeTag code={isBuy ? "P" : "S"} />
          ) : (
            <span className="rounded-sm bg-secondary px-1.5 py-0.5 font-mono text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {t.transaction_type}
            </span>
          )}
          <span className="font-mono text-sm font-semibold">{t.amount_range ?? "—"}</span>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 font-mono text-xs text-muted-foreground">
        <span>
          Traded {formatDate(t.transaction_date)} · Disclosed{" "}
          <a
            href={t.source_url}
            target="_blank"
            rel="noreferrer"
            title="View PTR PDF on House Clerk site"
            className="hover:text-foreground hover:underline"
          >
            {formatDate(t.filed_at)}
          </a>
        </span>
        {lag != null && (
          <span className={cn("flex shrink-0 items-center gap-1", late && "font-semibold text-sell")}>
            <Clock className="size-3.5" aria-hidden="true" />
            {lag}d lag
          </span>
        )}
      </div>
    </li>
  );
}

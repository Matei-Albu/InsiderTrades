import Link from "next/link";
import type { InsiderTrade } from "@/lib/types";
import { codeLabel, formatDate, formatMoney, formatPrice, formatShares } from "@/lib/format";

function RoleBadge({ trade }: { trade: InsiderTrade }) {
  const title = trade.insider_title?.toLowerCase() ?? "";
  const isTopExec = /chief executive|chief financial|\bceo\b|\bcfo\b|president/.test(title);
  if (isTopExec) {
    return (
      <span className="rounded bg-accent/15 px-1.5 py-0.5 text-[11px] font-medium text-accent">
        {trade.insider_title}
      </span>
    );
  }
  if (trade.insider_title) {
    return <span className="text-[11px] text-muted">{trade.insider_title}</span>;
  }
  if (trade.is_director) return <span className="text-[11px] text-muted">Director</span>;
  if (trade.is_ten_percent_owner)
    return <span className="text-[11px] text-muted">10% owner</span>;
  return null;
}

export default function TradesTable({
  trades,
  clusterTickers,
}: {
  trades: InsiderTrade[];
  clusterTickers?: Set<string>;
}) {
  if (trades.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-surface p-10 text-center text-muted">
        No filings match. Once the ingester has run, trades appear here.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-surface">
      <table className="w-full min-w-[760px] text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
            <th className="px-4 py-3">Company</th>
            <th className="px-4 py-3">Insider</th>
            <th className="px-4 py-3">Type</th>
            <th className="px-4 py-3 text-right">Shares</th>
            <th className="px-4 py-3 text-right">Price</th>
            <th className="px-4 py-3 text-right">Value</th>
            <th className="px-4 py-3 text-right">Δ Holdings</th>
            <th className="px-4 py-3 text-right">Filed</th>
          </tr>
        </thead>
        <tbody>
          {trades.map((t) => {
            const isBuy = t.transaction_code === "P";
            const isSell = t.transaction_code === "S";
            return (
              <tr
                key={t.id}
                className="border-b border-border/60 transition-colors last:border-0 hover:bg-surface-2"
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    {t.ticker ? (
                      <Link
                        href={`/stocks/${t.ticker}`}
                        className="font-mono font-semibold text-accent hover:underline"
                      >
                        {t.ticker}
                      </Link>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                    {t.ticker && clusterTickers?.has(t.ticker) && (
                      <span
                        title="Multiple insiders bought within 14 days"
                        className="rounded bg-gain/15 px-1.5 py-0.5 text-[11px] font-medium text-gain"
                      >
                        Cluster
                      </span>
                    )}
                  </div>
                  <div className="max-w-[220px] truncate text-xs text-muted">
                    {t.company_name}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="max-w-[200px] truncate">{t.insider_name}</div>
                  <RoleBadge trade={t} />
                </td>
                <td className="px-4 py-3">
                  <span
                    className={
                      isBuy
                        ? "font-medium text-gain"
                        : isSell
                          ? "font-medium text-loss"
                          : "text-muted"
                    }
                  >
                    {codeLabel(t.transaction_code)}
                  </span>
                </td>
                <td className="px-4 py-3 text-right font-mono">
                  {formatShares(t.shares)}
                </td>
                <td className="px-4 py-3 text-right font-mono">
                  {formatPrice(t.price_per_share)}
                </td>
                <td className="px-4 py-3 text-right font-mono font-medium">
                  {formatMoney(t.total_value)}
                </td>
                <td className="px-4 py-3 text-right font-mono text-xs">
                  {t.pct_holdings_increase != null && isBuy ? (
                    <span className="text-gain">+{t.pct_holdings_increase}%</span>
                  ) : (
                    <span className="text-muted">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right text-xs text-muted">
                  {t.source_url ? (
                    <a
                      href={t.source_url}
                      target="_blank"
                      rel="noreferrer"
                      className="hover:text-foreground hover:underline"
                      title="View filing on SEC EDGAR"
                    >
                      {formatDate(t.filed_at)}
                    </a>
                  ) : (
                    formatDate(t.filed_at)
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

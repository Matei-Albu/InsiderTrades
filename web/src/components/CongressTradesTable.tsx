import Link from "next/link";
import type { CongressTrade } from "@/lib/types";
import { formatDate } from "@/lib/format";

export default function CongressTradesTable({ trades }: { trades: CongressTrade[] }) {
  if (trades.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-surface p-10 text-center text-muted">
        No congressional trades yet. Run the congress ingester after applying
        migration 0005, then refresh.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-surface">
      <table className="w-full min-w-[800px] text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
            <th className="px-4 py-3">Member</th>
            <th className="px-4 py-3">Ticker</th>
            <th className="px-4 py-3">Type</th>
            <th className="px-4 py-3">Owner</th>
            <th className="px-4 py-3 text-right">Amount</th>
            <th className="px-4 py-3 text-right">Traded</th>
            <th className="px-4 py-3 text-right">Filed</th>
          </tr>
        </thead>
        <tbody>
          {trades.map((t) => {
            const isBuy = t.transaction_type === "purchase";
            const isSell = t.transaction_type === "sale";
            return (
              <tr
                key={t.id}
                className="border-b border-border/60 transition-colors last:border-0 hover:bg-surface-2"
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{t.politician_name}</span>
                    {t.party && (
                      <span
                        className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${
                          t.party === "D"
                            ? "bg-accent/15 text-accent"
                            : t.party === "R"
                              ? "bg-loss/15 text-loss"
                              : "bg-surface-2 text-muted"
                        }`}
                      >
                        {t.party}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-muted">
                    {[t.district, t.committees].filter(Boolean).join(" · ")}
                  </div>
                </td>
                <td className="px-4 py-3">
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
                  <div className="max-w-[220px] truncate text-xs text-muted">
                    {t.asset_name}
                  </div>
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
                    {isBuy ? "Buy" : isSell ? "Sell" : t.transaction_type}
                  </span>
                  {t.asset_type && (
                    <div className="text-[11px] text-muted">{t.asset_type}</div>
                  )}
                </td>
                <td className="px-4 py-3 text-xs text-muted">{t.owner ?? "—"}</td>
                <td className="px-4 py-3 text-right font-mono text-xs">
                  {t.amount_range ?? "—"}
                </td>
                <td className="px-4 py-3 text-right text-xs text-muted">
                  {formatDate(t.transaction_date)}
                </td>
                <td className="px-4 py-3 text-right text-xs text-muted">
                  <a
                    href={t.source_url}
                    target="_blank"
                    rel="noreferrer"
                    className="hover:text-foreground hover:underline"
                    title="View PTR PDF on House Clerk site"
                  >
                    {formatDate(t.filed_at)}
                  </a>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

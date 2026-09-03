import Link from "next/link";
import type { Metadata } from "next";
import { getClusterBuys } from "@/lib/queries";
import { formatDate, formatMoney, formatShares } from "@/lib/format";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Cluster Buys" };

export default async function ClustersPage() {
  const clusters = await getClusterBuys();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Cluster buys</h1>
        <p className="mt-1 text-sm text-muted">
          Companies where two or more insiders made open-market buys in the last
          14 days — historically one of the strongest insider signals.
        </p>
      </div>

      {clusters.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface p-10 text-center text-muted">
          No active clusters right now. Check back after the next ingest run.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {clusters.map((c) => (
            <Link
              key={c.company_cik}
              href={c.ticker ? `/stocks/${c.ticker}` : "#"}
              className="rounded-xl border border-border bg-surface p-5 transition-colors hover:border-gain/50"
            >
              <div className="flex items-baseline justify-between">
                <span className="font-mono text-lg font-semibold text-accent">
                  {c.ticker ?? "—"}
                </span>
                <span className="rounded bg-gain/15 px-2 py-0.5 text-xs font-medium text-gain">
                  {c.insider_count} insiders
                </span>
              </div>
              <div className="mt-1 truncate text-sm text-muted">{c.company_name}</div>
              <dl className="mt-4 space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted">Total bought</dt>
                  <dd className="font-mono font-medium text-gain">
                    {formatMoney(c.total_value)}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted">Shares</dt>
                  <dd className="font-mono">{formatShares(c.total_shares)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted">Window</dt>
                  <dd className="text-xs">
                    {formatDate(c.first_buy)} – {formatDate(c.last_buy)}
                  </dd>
                </div>
              </dl>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

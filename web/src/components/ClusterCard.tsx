import Link from "next/link";
import { insiderRole } from "@/components/InsiderTradeRow";
import { PersonAvatar, TickerLogo } from "@/components/media";
import WatchButton from "@/components/WatchButton";
import { formatDate, formatMoney, formatPrice, formatShares } from "@/lib/format";
import type { ClusterBuy, InsiderTrade } from "@/lib/types";

type ClusterInsider = { cik: string; name: string; role: string | null; value: number };

/** Collapse a cluster's individual buys into one line per insider, biggest first. */
function groupInsiders(buys: InsiderTrade[]): ClusterInsider[] {
  const byCik = new Map<string, ClusterInsider>();
  for (const t of buys) {
    const existing = byCik.get(t.insider_cik);
    if (existing) {
      existing.value += t.total_value ?? 0;
    } else {
      byCik.set(t.insider_cik, {
        cik: t.insider_cik,
        name: t.insider_name,
        role: insiderRole(t)?.text ?? null,
        value: t.total_value ?? 0,
      });
    }
  }
  return [...byCik.values()].sort((a, b) => b.value - a.value);
}

export default function ClusterCard({
  cluster,
  buys,
  watching,
  signedIn,
}: {
  cluster: ClusterBuy;
  buys: InsiderTrade[];
  watching: boolean;
  signedIn: boolean;
}) {
  const people = groupInsiders(buys);
  const avgPrice =
    cluster.total_value && cluster.total_shares
      ? cluster.total_value / cluster.total_shares
      : null;

  return (
    <article className="flex flex-col overflow-hidden rounded-lg border bg-card">
      <div className="flex items-start justify-between gap-4 p-5">
        <div className="flex min-w-0 items-center gap-4">
          <TickerLogo symbol={cluster.ticker} name={cluster.company_name} size="lg" />
          <div className="flex min-w-0 flex-col gap-0.5">
            <h3 className="font-mono text-xl font-semibold">
              {cluster.ticker ? (
                <Link href={`/stocks/${cluster.ticker}`} className="hover:underline">
                  {cluster.ticker}
                </Link>
              ) : (
                "—"
              )}
            </h3>
            <p className="truncate text-sm text-muted-foreground">{cluster.company_name}</p>
          </div>
        </div>
        {cluster.ticker && (
          <WatchButton
            variant="icon"
            ticker={cluster.ticker}
            initialWatching={watching}
            signedIn={signedIn}
          />
        )}
      </div>

      <div className="flex items-center gap-4 border-y bg-secondary/50 px-5 py-4">
        <div className="flex -space-x-3">
          {people.slice(0, 4).map((p) => (
            <PersonAvatar key={p.cik} name={p.name} size="md" />
          ))}
        </div>
        <p className="text-sm leading-snug">
          <span className="font-semibold">{cluster.insider_count} insiders</span> bought
          within <span className="font-semibold">14 days</span>
          <span className="block font-mono text-xs text-muted-foreground">
            {formatDate(cluster.first_buy)} – {formatDate(cluster.last_buy)}
          </span>
        </p>
      </div>

      <dl className="grid grid-cols-3 divide-x border-b">
        <div className="flex flex-col gap-1 px-5 py-4">
          <dt className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
            Bought
          </dt>
          <dd className="font-mono text-base font-semibold text-buy">
            {formatMoney(cluster.total_value)}
          </dd>
        </div>
        <div className="flex flex-col gap-1 px-5 py-4">
          <dt className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
            Avg price
          </dt>
          <dd className="font-mono text-base font-semibold">{formatPrice(avgPrice)}</dd>
        </div>
        <div className="flex flex-col gap-1 px-5 py-4">
          <dt className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
            Shares
          </dt>
          <dd className="font-mono text-base font-semibold">
            {formatShares(cluster.total_shares)}
          </dd>
        </div>
      </dl>

      <ul className="flex flex-col divide-y">
        {people.map((p) => (
          <li key={p.cik} className="flex items-center justify-between gap-3 px-5 py-3">
            <div className="flex min-w-0 items-center gap-3">
              <PersonAvatar name={p.name} size="sm" />
              <div className="flex min-w-0 flex-col">
                <span className="truncate text-sm font-medium">{p.name}</span>
                {p.role && (
                  <span className="truncate text-xs text-muted-foreground">{p.role}</span>
                )}
              </div>
            </div>
            <span className="font-mono text-sm text-buy">+{formatMoney(p.value)}</span>
          </li>
        ))}
      </ul>
    </article>
  );
}

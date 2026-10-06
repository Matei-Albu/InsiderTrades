import Link from "next/link";
import { Suspense } from "react";
import { ArrowRight } from "lucide-react";
import InsiderTradeRow, { insiderRole } from "@/components/InsiderTradeRow";
import {
  PartyTag,
  PersonAvatar,
  TickerLogo,
  TradeTypeTag,
} from "@/components/media";
import { buttonVariants } from "@/components/ui/button";
import { formatDate, formatMoney, formatPrice, formatShares } from "@/lib/format";
import {
  getInstitutions,
  getLatestInstitutionMoves,
  getTrades,
} from "@/lib/queries";
import type { ClusterBuy, CongressTrade, InsiderTrade, Politician } from "@/lib/types";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ hero */

function HeroFiling({ trade, label }: { trade: InsiderTrade; label: string }) {
  const isBuy = trade.transaction_code === "P";
  const isSell = trade.transaction_code === "S";
  const role = insiderRole(trade)?.text;
  const body = (
    <>
      <div className="flex items-center justify-between">
        <span className="font-mono text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        <TradeTypeTag code={trade.transaction_code} />
      </div>
      <div className="flex items-center gap-3">
        <PersonAvatar name={trade.insider_name} size="md" />
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-sm font-semibold">{trade.insider_name}</span>
          <span className="truncate text-xs text-muted-foreground">
            {[role, trade.ticker].filter(Boolean).join(", ")}
          </span>
        </div>
      </div>
      <div className="flex items-center justify-between border-t pt-3">
        <div className="flex items-center gap-2">
          <TickerLogo symbol={trade.ticker} name={trade.company_name} size="sm" />
          <span className="font-mono text-xs text-muted-foreground">
            {formatShares(trade.shares)} @ {formatPrice(trade.price_per_share)}
          </span>
        </div>
        <span
          className={cn(
            "font-mono font-semibold",
            isBuy && "text-buy",
            isSell && "text-sell",
          )}
        >
          {isBuy ? "+" : isSell ? "−" : ""}
          {formatMoney(trade.total_value)}
        </span>
      </div>
    </>
  );
  const cls =
    "flex flex-col gap-3 rounded-lg border bg-card p-4 shadow-sm transition-colors";
  return trade.ticker ? (
    <Link href={`/stocks/${trade.ticker}`} className={cn(cls, "hover:border-primary/50")}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

export function HomeHero({
  trades,
  signedIn,
}: {
  trades: InsiderTrade[];
  signedIn: boolean;
}) {
  return (
    <section className="border-b bg-card">
      <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-14 md:px-6 lg:grid-cols-2 lg:py-20">
        <div className="flex flex-col gap-6">
          <p className="font-mono text-xs font-medium uppercase tracking-widest text-primary">
            Form 4 · STOCK Act · 13F
          </p>
          <h1 className="text-balance text-4xl font-semibold leading-tight tracking-tight md:text-5xl">
            See what insiders, Congress and funds are buying — the day it&apos;s filed.
          </h1>
          <p className="max-w-lg text-pretty text-lg leading-relaxed text-muted-foreground">
            InsiderTrades parses every insider filing, congressional disclosure and
            institutional holdings report into one clean feed, then flags the
            clusters worth your attention.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/feed" className={cn(buttonVariants({ size: "lg" }), "h-11 px-5")}>
              Open the live feed <ArrowRight />
            </Link>
            {!signedIn && (
              <Link
                href="/login"
                className={cn(buttonVariants({ variant: "outline", size: "lg" }), "h-11 px-5")}
              >
                Create free account
              </Link>
            )}
          </div>
        </div>

        {trades.length > 0 && (
          <div className="flex flex-col gap-3 lg:ml-auto lg:w-full lg:max-w-md">
            {trades.map((t, i) => (
              <HeroFiling
                key={t.id}
                trade={t}
                label={i === 0 ? "Just filed" : formatDate(t.filed_at)}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

/* --------------------------------------------------------------- modules */

const CARD =
  "group flex flex-col gap-5 rounded-lg border bg-card p-5 transition-colors hover:border-primary/50";

function CardHeading({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="flex items-start justify-between">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </div>
      <ArrowRight className="size-5 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
    </div>
  );
}

function CongressCard({
  trades,
  politicians,
}: {
  trades: CongressTrade[];
  politicians: Politician[];
}) {
  return (
    <Link href="/congress" className={CARD}>
      <CardHeading title="Congress trades" subtitle="House STOCK Act disclosures" />
      <div className="flex -space-x-3">
        {politicians.slice(0, 4).map((p) => (
          <PersonAvatar key={p.id} name={p.name} size="lg" />
        ))}
      </div>
      <ul className="flex flex-col gap-2.5 border-t pt-4">
        {trades.length === 0 && (
          <li className="text-sm text-muted-foreground">No disclosures yet.</li>
        )}
        {trades.map((t) => {
          const isBuy = t.transaction_type === "purchase";
          const isSell = t.transaction_type === "sale";
          return (
            <li key={t.id} className="flex items-center justify-between gap-2 text-sm">
              <span className="flex min-w-0 items-center gap-2">
                <span className="truncate font-medium">{t.politician_name}</span>
                <PartyTag party={t.party} state={t.state} />
              </span>
              <span
                className={cn(
                  "shrink-0 font-mono text-xs font-semibold",
                  isBuy && "text-buy",
                  isSell && "text-sell",
                )}
              >
                {isBuy ? "Buy" : isSell ? "Sell" : t.transaction_type}{" "}
                {t.ticker ?? ""}
              </span>
            </li>
          );
        })}
      </ul>
    </Link>
  );
}

async function ClusterModule({ cluster }: { cluster: ClusterBuy | undefined }) {
  let people: InsiderTrade[] = [];
  if (cluster?.ticker) {
    const buys = await getTrades(
      { side: "buys", minValue: 0, ticker: cluster.ticker },
      12,
    ).catch(() => [] as InsiderTrade[]);
    const seen = new Set<string>();
    for (const t of buys) {
      if (t.transaction_date && t.transaction_date < cluster.first_buy) continue;
      if (seen.has(t.insider_cik)) continue;
      seen.add(t.insider_cik);
      people.push(t);
    }
    people = people.slice(0, 3);
  }

  return (
    <Link href="/clusters" className={CARD}>
      <CardHeading title="Cluster buys" subtitle="2+ insiders, same stock, 14 days" />
      {cluster ? (
        <>
          <div className="flex items-center gap-4">
            <TickerLogo symbol={cluster.ticker} name={cluster.company_name} size="lg" />
            <div className="flex min-w-0 flex-col">
              <span className="font-mono text-2xl font-semibold">
                {cluster.ticker ?? "—"}
              </span>
              <span className="font-mono text-sm text-buy">
                +{formatMoney(cluster.total_value)} bought
              </span>
            </div>
          </div>
          <ul className="flex flex-col gap-2.5 border-t pt-4">
            {people.map((t) => (
              <li key={t.insider_cik} className="flex items-center gap-2.5 text-sm">
                <PersonAvatar name={t.insider_name} size="sm" />
                <span className="truncate font-medium">{t.insider_name}</span>
                <span className="truncate text-xs text-muted-foreground">
                  {insiderRole(t)?.text}
                </span>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="border-t pt-4 text-sm text-muted-foreground">
          No active clusters right now. Check back after the next ingest run.
        </p>
      )}
    </Link>
  );
}

const MOVE_LABEL = { new: "New", added: "Added", trimmed: "Trimmed" } as const;

async function InstitutionsModule() {
  const [institutions, moves] = await Promise.all([
    getInstitutions().catch(() => []),
    getLatestInstitutionMoves(3).catch(() => []),
  ]);

  return (
    <Link href="/institutions" className={CARD}>
      <CardHeading title="Institution trades" subtitle="Quarterly 13F position changes" />
      <div className="flex gap-2">
        {institutions.slice(0, 4).map((i) => (
          <TickerLogo key={i.cik} symbol={null} name={i.name} size="md" />
        ))}
      </div>
      <ul className="flex flex-col gap-2.5 border-t pt-4">
        {moves.length === 0 && (
          <li className="text-sm text-muted-foreground">No 13F changes yet.</li>
        )}
        {moves.map((m) => (
          <li
            key={`${m.institution_cik}-${m.cusip}`}
            className="flex items-center justify-between gap-2 text-sm"
          >
            <span className="truncate font-medium">{m.institution_name}</span>
            <span
              className={cn(
                "shrink-0 font-mono text-xs font-semibold",
                m.change === "trimmed" ? "text-sell" : "text-buy",
              )}
            >
              {m.change !== "unchanged" && MOVE_LABEL[m.change]} {m.ticker}
            </span>
          </li>
        ))}
      </ul>
    </Link>
  );
}

function ModuleSkeleton() {
  return (
    <div className="flex h-72 flex-col gap-5 rounded-lg border bg-card p-5" aria-hidden="true">
      <div className="h-5 w-40 animate-pulse rounded bg-secondary" />
      <div className="h-14 w-full animate-pulse rounded bg-secondary" />
      <div className="mt-auto h-20 w-full animate-pulse rounded bg-secondary" />
    </div>
  );
}

export function TrackerModules({
  congress,
  politicians,
  topCluster,
}: {
  congress: CongressTrade[];
  politicians: Politician[];
  topCluster: ClusterBuy | undefined;
}) {
  return (
    <section className="grid gap-4 lg:grid-cols-3" aria-label="Trackers">
      <CongressCard trades={congress.slice(0, 3)} politicians={politicians} />
      <Suspense fallback={<ModuleSkeleton />}>
        <ClusterModule cluster={topCluster} />
      </Suspense>
      <Suspense fallback={<ModuleSkeleton />}>
        <InstitutionsModule />
      </Suspense>
    </section>
  );
}

/* --------------------------------------------------------- latest filings */

function SectionHeading({
  title,
  href,
  linkLabel,
}: {
  title: string;
  href: string;
  linkLabel: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
      <Link
        href={href}
        className="flex items-center gap-1 text-sm font-medium text-primary hover:underline"
      >
        {linkLabel} <ArrowRight className="size-4" aria-hidden="true" />
      </Link>
    </div>
  );
}

export function LatestFilings({
  trades,
  clusterTickers,
  watched,
  signedIn,
}: {
  trades: InsiderTrade[];
  clusterTickers: Set<string>;
  watched: Set<string>;
  signedIn: boolean;
}) {
  return (
    <section className="flex flex-col gap-4" aria-label="Latest insider filings">
      <SectionHeading title="Latest insider filings" href="/feed" linkLabel="Full feed" />
      <ul className="divide-y overflow-hidden rounded-lg border bg-card">
        {trades.length === 0 && (
          <li className="px-5 py-12 text-center text-sm text-muted-foreground">
            No filings yet. Once the ingester has run, trades appear here.
          </li>
        )}
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
    </section>
  );
}

/* ------------------------------------------------------------ watchlist cta */

export function WatchlistCta({ symbols }: { symbols: string[] }) {
  return (
    <section className="flex flex-col items-start gap-6 rounded-lg bg-primary p-8 text-primary-foreground md:flex-row md:items-center md:justify-between md:p-10">
      <div className="flex max-w-xl flex-col gap-3">
        <h2 className="text-balance text-2xl font-semibold tracking-tight">
          Build a watchlist. Get emailed when anyone with an edge moves.
        </h2>
        <p className="leading-relaxed text-primary-foreground/80">
          Star tickers anywhere on the site. We&apos;ll email you when new Form 4
          filings land for those names.
        </p>
        {symbols.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-2">
            {symbols.map((s) => (
              <span
                key={s}
                className="flex items-center gap-1.5 rounded-md bg-card py-1 pr-2.5 pl-1 text-foreground"
              >
                <TickerLogo
                  symbol={s}
                  name={s}
                  size="sm"
                  className="size-6 border-0 p-0.5"
                />
                <span className="font-mono text-xs font-semibold">{s}</span>
              </span>
            ))}
          </div>
        )}
      </div>
      <Link
        href="/watchlist"
        className={cn(
          buttonVariants({ variant: "secondary", size: "lg" }),
          "h-11 shrink-0 px-5",
        )}
      >
        Go to watchlist <ArrowRight />
      </Link>
    </section>
  );
}

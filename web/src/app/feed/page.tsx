import type { Metadata } from "next";
import { Search } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import ResultsLimit, {
  DEFAULT_RESULT_LIMIT,
  parseResultLimit,
} from "@/components/ResultsLimit";
import SegmentedLinks from "@/components/SegmentedLinks";
import TradesList from "@/components/TradesList";
import { Input } from "@/components/ui/input";
import {
  getClusterTickers,
  getTrades,
  getUserWatchlist,
  sanitizeSearch,
  type FeedFilter,
} from "@/lib/queries";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Live feed" };

const sides = [
  { key: "buys", label: "Buys" },
  { key: "sells", label: "Sells" },
  { key: "all", label: "All activity" },
] as const;

const minValues = [
  { key: 0, label: "Any size" },
  { key: 50_000, label: "$50K+" },
  { key: 250_000, label: "$250K+" },
  { key: 1_000_000, label: "$1M+" },
] as const;

type Filters = { side: string; min: number; limit: number; q: string };

function filterParams({ side, min, limit, q }: Filters) {
  const params = new URLSearchParams();
  if (side !== "buys") params.set("side", side);
  if (min > 0) params.set("min", String(min));
  if (limit !== DEFAULT_RESULT_LIMIT) params.set("limit", String(limit));
  if (q) params.set("q", q);
  return params;
}

function filterHref(filters: Filters) {
  const qs = filterParams(filters).toString();
  return qs ? `/feed?${qs}` : "/feed";
}

function first(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v;
}

export default async function FeedPage({ searchParams }: PageProps<"/feed">) {
  const params = await searchParams;
  const sideRaw = first(params.side);
  const side = (["buys", "sells", "all"].includes(String(sideRaw))
    ? sideRaw
    : "buys") as FeedFilter["side"];
  const minValue = Number(first(params.min)) || 0;
  const limit = parseResultLimit(params.limit);
  const q = sanitizeSearch(first(params.q));
  const current: Filters = { side, min: minValue, limit, q };

  const [trades, clusterTickers, { user, watched }] = await Promise.all([
    getTrades({ side, minValue, search: q }, limit),
    getClusterTickers(),
    getUserWatchlist(),
  ]);

  // The search box is a plain GET form; carry the other filters along as hidden fields.
  const hidden = Array.from(filterParams({ ...current, q: "" }).entries());

  return (
    <>
      <PageHeader
        eyebrow="Form 4 · Live"
        title="Latest insider trades"
        description="Open-market purchases and sales by officers, directors and 10% owners, straight from SEC Form 4 filings."
      >
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="relative flex size-2">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-buy opacity-60" />
            <span className="relative inline-flex size-2 rounded-full bg-buy" />
          </span>
          Refreshed every 15 min on market days
        </div>
      </PageHeader>

      <div className="mx-auto max-w-6xl px-4 py-8 md:px-6">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-wrap gap-2">
              <SegmentedLinks
                label="Trade type"
                options={sides.map((s) => ({
                  key: s.key,
                  label: s.label,
                  href: filterHref({ ...current, side: s.key }),
                  active: side === s.key,
                }))}
              />
              <SegmentedLinks
                label="Trade size"
                options={minValues.map((m) => ({
                  key: m.key,
                  label: m.label,
                  href: filterHref({ ...current, min: m.key }),
                  active: minValue === m.key,
                }))}
              />
            </div>
            <form action="/feed" method="get" role="search" className="relative md:w-72">
              {hidden.map(([k, v]) => (
                <input key={k} type="hidden" name={k} value={v} />
              ))}
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                name="q"
                defaultValue={q}
                key={q}
                placeholder="Ticker, company or insider"
                aria-label="Filter by ticker, company or insider"
                className="h-9 bg-card pl-9"
              />
            </form>
          </div>

          <TradesList
            trades={trades}
            clusterTickers={clusterTickers}
            watched={watched}
            signedIn={!!user}
          />

          <ResultsLimit
            current={limit}
            shown={trades.length}
            buildHref={(n) => filterHref({ ...current, limit: n })}
          />
        </div>
      </div>
    </>
  );
}

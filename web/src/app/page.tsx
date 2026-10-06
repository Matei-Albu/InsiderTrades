import { redirect } from "next/navigation";
import {
  HomeHero,
  LatestFilings,
  TrackerModules,
  WatchlistCta,
} from "@/components/HomeSections";
import TickerTape, { type TapeItem } from "@/components/TickerTape";
import { formatMoney } from "@/lib/format";
import {
  getClusterBuys,
  getCongressTrades,
  getPoliticians,
  getTrades,
  getUserWatchlist,
} from "@/lib/queries";

export const dynamic = "force-dynamic";

// The feed used to live at "/", so old bookmarks like /?side=all still work.
const LEGACY_FEED_PARAMS = ["side", "min", "limit", "q"] as const;

/** The landing page should still render if one non-essential section fails. */
async function safe<T>(label: string, promise: Promise<T>, fallback: T): Promise<T> {
  try {
    return await promise;
  } catch (err) {
    console.error(`home: ${label} failed`, err);
    return fallback;
  }
}

export default async function HomePage({ searchParams }: PageProps<"/">) {
  const params = await searchParams;
  const legacy = new URLSearchParams();
  for (const key of LEGACY_FEED_PARAMS) {
    const v = Array.isArray(params[key]) ? params[key][0] : params[key];
    if (v) legacy.set(key, v);
  }
  if (legacy.size > 0) redirect(`/feed?${legacy.toString()}`);

  const [buys, sells, congress, politicians, clusters, { user, watched }] =
    await Promise.all([
      safe("buys", getTrades({ side: "buys", minValue: 0 }, 12), []),
      safe("sells", getTrades({ side: "sells", minValue: 0 }, 6), []),
      safe("congress", getCongressTrades({ side: "all" }, 8), []),
      safe("politicians", getPoliticians(), []),
      safe("clusters", getClusterBuys(), []),
      safe("watchlist", getUserWatchlist(), {
        user: null,
        watched: new Set<string>(),
      }),
    ]);

  const clusterTickers = new Set(
    clusters.map((c) => c.ticker).filter((t): t is string => !!t),
  );

  const tape: TapeItem[] = [
    ...[...buys, ...sells]
      .sort((a, b) => b.filed_at.localeCompare(a.filed_at))
      .flatMap((t) =>
        t.ticker
          ? [
              {
                key: `f4-${t.id}`,
                symbol: t.ticker,
                who: t.insider_name,
                type: t.transaction_code === "P" ? ("Buy" as const) : ("Sell" as const),
                amount: formatMoney(t.total_value),
              },
            ]
          : [],
      ),
    ...congress
      .flatMap((t) =>
        t.ticker &&
        (t.transaction_type === "purchase" || t.transaction_type === "sale")
          ? [
              {
                key: `congress-${t.id}`,
                symbol: t.ticker,
                who: t.politician_name,
                type:
                  t.transaction_type === "purchase"
                    ? ("Buy" as const)
                    : ("Sell" as const),
                amount:
                  t.amount_min != null ? `${formatMoney(t.amount_min)}+` : "—",
              },
            ]
          : [],
      )
      .slice(0, 5),
  ];

  const ctaSymbols = [
    ...new Set(buys.map((t) => t.ticker).filter((t): t is string => !!t)),
  ].slice(0, 6);

  return (
    <main>
      <TickerTape items={tape} />
      <HomeHero trades={buys.slice(0, 3)} signedIn={!!user} />
      <div className="mx-auto flex max-w-6xl flex-col gap-14 px-4 py-16 md:px-6">
        <TrackerModules
          congress={congress}
          politicians={politicians}
          topCluster={clusters[0]}
        />
        <LatestFilings
          trades={buys.slice(0, 6)}
          clusterTickers={clusterTickers}
          watched={watched}
          signedIn={!!user}
        />
        <WatchlistCta symbols={ctaSymbols} />
      </div>
    </main>
  );
}

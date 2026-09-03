import Link from "next/link";
import TradesTable from "@/components/TradesTable";
import { getClusterTickers, getTrades, type FeedFilter } from "@/lib/queries";

export const dynamic = "force-dynamic";

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

function filterHref(side: string, min: number) {
  const params = new URLSearchParams();
  if (side !== "buys") params.set("side", side);
  if (min > 0) params.set("min", String(min));
  const qs = params.toString();
  return qs ? `/?${qs}` : "/";
}

export default async function FeedPage({
  searchParams,
}: PageProps<"/">) {
  const params = await searchParams;
  const side = (["buys", "sells", "all"].includes(String(params.side))
    ? params.side
    : "buys") as FeedFilter["side"];
  const minValue = Number(params.min) || 0;

  const [trades, clusterTickers] = await Promise.all([
    getTrades({ side, minValue }),
    getClusterTickers(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Insider activity</h1>
        <p className="mt-1 text-sm text-muted">
          Latest SEC Form 4 filings, refreshed every 15 minutes on market days.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <div className="flex rounded-lg border border-border bg-surface p-0.5 text-sm">
          {sides.map((s) => (
            <Link
              key={s.key}
              href={filterHref(s.key, minValue)}
              className={`rounded-md px-3 py-1.5 transition-colors ${
                side === s.key
                  ? "bg-surface-2 font-medium"
                  : "text-muted hover:text-foreground"
              }`}
            >
              {s.label}
            </Link>
          ))}
        </div>
        <div className="flex rounded-lg border border-border bg-surface p-0.5 text-sm">
          {minValues.map((m) => (
            <Link
              key={m.key}
              href={filterHref(side, m.key)}
              className={`rounded-md px-3 py-1.5 transition-colors ${
                minValue === m.key
                  ? "bg-surface-2 font-medium"
                  : "text-muted hover:text-foreground"
              }`}
            >
              {m.label}
            </Link>
          ))}
        </div>
      </div>

      <TradesTable trades={trades} clusterTickers={clusterTickers} />
    </div>
  );
}

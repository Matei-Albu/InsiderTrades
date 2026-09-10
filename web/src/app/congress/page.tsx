import Link from "next/link";
import type { Metadata } from "next";
import CongressTradesTable from "@/components/CongressTradesTable";
import ResultsLimit, {
  DEFAULT_RESULT_LIMIT,
  parseResultLimit,
} from "@/components/ResultsLimit";
import {
  getCongressTrades,
  getPoliticians,
  type CongressFilter,
} from "@/lib/queries";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Congress" };

const sides = [
  { key: "all", label: "All" },
  { key: "buys", label: "Buys" },
  { key: "sells", label: "Sells" },
] as const;

function filterHref(side: string, politician: string, limit: number) {
  const params = new URLSearchParams();
  if (side !== "all") params.set("side", side);
  if (politician) params.set("member", politician);
  if (limit !== DEFAULT_RESULT_LIMIT) params.set("limit", String(limit));
  const qs = params.toString();
  return qs ? `/congress?${qs}` : "/congress";
}

export default async function CongressPage({
  searchParams,
}: PageProps<"/congress">) {
  const params = await searchParams;
  const sideRaw = Array.isArray(params.side) ? params.side[0] : params.side;
  const side = (["buys", "sells", "all"].includes(String(sideRaw))
    ? sideRaw
    : "all") as CongressFilter["side"];
  const memberRaw = Array.isArray(params.member) ? params.member[0] : params.member;
  const politician = typeof memberRaw === "string" ? memberRaw : "";
  const limit = parseResultLimit(params.limit);

  const [trades, politicians] = await Promise.all([
    getCongressTrades({ side, politician: politician || undefined }, limit),
    getPoliticians(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Congress trades</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          STOCK Act Periodic Transaction Reports for a curated set of House
          members. Amounts are disclosed as ranges. Senate members and the
          President are not in this House Clerk feed.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <div className="flex rounded-lg border border-border bg-surface p-0.5 text-sm">
          {sides.map((s) => (
            <Link
              key={s.key}
              href={filterHref(s.key, politician, limit)}
              scroll={false}
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
      </div>

      <div className="flex flex-wrap gap-2">
        <Link
          href={filterHref(side, "", limit)}
          scroll={false}
          className={`rounded-full border px-3 py-1 text-xs transition-colors ${
            !politician
              ? "border-foreground bg-foreground text-background"
              : "border-border text-muted hover:text-foreground"
          }`}
        >
          All members
        </Link>
        {politicians.map((p) => (
          <Link
            key={p.id}
            href={filterHref(side, p.slug, limit)}
            scroll={false}
            className={`rounded-full border px-3 py-1 text-xs transition-colors ${
              politician === p.slug
                ? "border-foreground bg-foreground text-background"
                : "border-border text-muted hover:text-foreground"
            }`}
          >
            {p.name}
          </Link>
        ))}
      </div>

      <CongressTradesTable trades={trades} />
      <ResultsLimit
        current={limit}
        shown={trades.length}
        buildHref={(n) => filterHref(side, politician, n)}
      />
    </div>
  );
}

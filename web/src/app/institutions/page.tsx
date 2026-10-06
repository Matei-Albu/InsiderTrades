import Link from "next/link";
import type { Metadata } from "next";
import { HoldingChangeTag, TickerLogo } from "@/components/media";
import PageHeader from "@/components/PageHeader";
import SegmentedLinks from "@/components/SegmentedLinks";
import WatchButton from "@/components/WatchButton";
import { formatDate, formatMoney, formatShares } from "@/lib/format";
import {
  getInstitutions,
  getLatestInstitutionMoves,
  getUserWatchlist,
} from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";
import type { Filing13F } from "@/lib/types";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Institutions" };

const actions = [
  { key: "", label: "All moves" },
  { key: "new", label: "New" },
  { key: "added", label: "Added" },
  { key: "trimmed", label: "Trimmed" },
] as const;

type Action = "new" | "added" | "trimmed";

function actionHref(action: string) {
  return action ? `/institutions?action=${action}` : "/institutions";
}

export default async function InstitutionsPage({
  searchParams,
}: PageProps<"/institutions">) {
  const params = await searchParams;
  const raw = Array.isArray(params.action) ? params.action[0] : params.action;
  const action = (["new", "added", "trimmed"].includes(String(raw)) ? raw : "") as
    | Action
    | "";

  const supabase = await createClient();
  const [institutions, filingsResult, moves, { user, watched }] = await Promise.all([
    getInstitutions(),
    supabase
      .from("filings_13f")
      .select("*")
      .order("period_of_report", { ascending: false }),
    getLatestInstitutionMoves(25, action || undefined).catch(() => []),
    getUserWatchlist(),
  ]);

  // Latest filing per institution for the summary tiles.
  const latestByCik = new Map<string, Filing13F>();
  for (const f of filingsResult.data ?? []) {
    if (!latestByCik.has(f.institution_cik)) latestByCik.set(f.institution_cik, f);
  }

  return (
    <main>
      <PageHeader
        eyebrow="13F-HR · Quarterly holdings"
        title="Institution trades"
        description="Quarterly 13F portfolios of notable funds and family offices — what they opened, added to and trimmed."
      />
      <div className="mx-auto flex max-w-6xl flex-col gap-10 px-4 py-8 md:px-6">
        <section aria-labelledby="funds-heading" className="flex flex-col gap-4">
          <h2 id="funds-heading" className="text-lg font-semibold">
            Tracked managers
          </h2>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {institutions.map((inst) => {
              const latest = latestByCik.get(inst.cik);
              return (
                <li key={inst.cik}>
                  <Link
                    href={`/institutions/${inst.slug}`}
                    className="flex w-full items-center gap-4 rounded-lg border bg-card p-4 text-left transition-colors hover:border-primary/50"
                  >
                    <TickerLogo symbol={null} name={inst.name} size="lg" />
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <span className="truncate font-semibold">{inst.name}</span>
                      {inst.manager && (
                        <span className="truncate text-xs text-muted-foreground">
                          {inst.manager}
                        </span>
                      )}
                      <span className="font-mono text-xs">
                        {latest
                          ? `${formatMoney(latest.total_value)} · ${formatDate(latest.period_of_report)}`
                          : "not ingested yet"}
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>

        <section aria-labelledby="moves-heading" className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <h2 id="moves-heading" className="text-lg font-semibold">
              Biggest recent position changes
            </h2>
            <SegmentedLinks
              label="Action"
              options={actions.map((a) => ({
                key: a.key || "all",
                label: a.label,
                href: actionHref(a.key),
                active: action === a.key,
              }))}
            />
          </div>

          <div className="overflow-x-auto rounded-lg border bg-card">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="border-b bg-secondary/60 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th scope="col" className="px-5 py-2.5 text-left font-medium">Fund</th>
                  <th scope="col" className="px-5 py-2.5 text-left font-medium">Position</th>
                  <th scope="col" className="px-5 py-2.5 text-left font-medium">Action</th>
                  <th scope="col" className="px-5 py-2.5 text-right font-medium">Shares Δ</th>
                  <th scope="col" className="px-5 py-2.5 text-right font-medium">Value</th>
                  <th scope="col" className="w-12 px-3 py-2.5">
                    <span className="sr-only">Watch</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {moves.map((m) => {
                  const delta = m.shares - (m.prev_shares ?? 0);
                  return (
                    <tr key={`${m.institution_cik}-${m.cusip}-${m.period_of_report}`}>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <TickerLogo symbol={null} name={m.institution_name} size="sm" />
                          {m.institution_slug ? (
                            <Link
                              href={`/institutions/${m.institution_slug}`}
                              className="font-medium hover:underline"
                            >
                              {m.institution_name}
                            </Link>
                          ) : (
                            <span className="font-medium">{m.institution_name}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <TickerLogo symbol={m.ticker} name={m.issuer_name} size="sm" />
                          <div className="flex min-w-0 flex-col">
                            {m.ticker ? (
                              <Link
                                href={`/stocks/${m.ticker}`}
                                className="font-mono font-semibold hover:underline"
                              >
                                {m.ticker}
                              </Link>
                            ) : (
                              <span className="font-mono font-semibold">{m.cusip}</span>
                            )}
                            <span className="max-w-[220px] truncate text-xs text-muted-foreground">
                              {m.issuer_name}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <HoldingChangeTag change={m.change} />
                      </td>
                      <td
                        className={cn(
                          "px-5 py-3.5 text-right font-mono tabular-nums",
                          delta >= 0 ? "text-buy" : "text-sell",
                        )}
                      >
                        {delta >= 0 ? "+" : "−"}
                        {formatShares(Math.abs(delta))}
                        <span className="block text-xs text-muted-foreground">
                          {m.pct_change_shares != null
                            ? `${m.pct_change_shares > 0 ? "+" : ""}${m.pct_change_shares}%`
                            : m.change === "new"
                              ? "new"
                              : "—"}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right font-mono font-semibold tabular-nums">
                        {formatMoney(m.value)}
                      </td>
                      <td className="px-3 py-3.5">
                        {m.ticker && (
                          <WatchButton
                            variant="icon"
                            ticker={m.ticker}
                            initialWatching={watched.has(m.ticker)}
                            signedIn={!!user}
                          />
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {moves.length === 0 && (
              <p className="px-5 py-12 text-center text-sm text-muted-foreground">
                No position changes match.
              </p>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { HoldingChangeTag, TickerLogo } from "@/components/media";
import PageHeader from "@/components/PageHeader";
import {
  getHoldingChanges,
  getInstitutionBySlug,
  getInstitutionFilings,
} from "@/lib/queries";
import { formatDate, formatMoney, formatShares } from "@/lib/format";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function InstitutionPage({
  params,
  searchParams,
}: PageProps<"/institutions/[slug]">) {
  const { slug } = await params;
  const { q } = await searchParams;

  const institution = await getInstitutionBySlug(slug);
  if (!institution) notFound();

  const filings = await getInstitutionFilings(institution.cik);
  const period =
    typeof q === "string" && filings.some((f) => f.period_of_report === q)
      ? q
      : filings[0]?.period_of_report;
  const holdings = period ? await getHoldingChanges(institution.cik, period) : [];
  const currentFiling = filings.find((f) => f.period_of_report === period);
  const totalValue = currentFiling?.total_value ?? 0;

  return (
    <main>
      <PageHeader
        eyebrow="13F-HR · Institution"
        title={institution.name}
        description={institution.manager ?? "Quarterly 13F portfolio"}
      >
        {currentFiling && (
          <div className="flex flex-col md:items-end">
            <span className="font-mono text-2xl font-semibold">
              {formatMoney(currentFiling.total_value)}
            </span>
            <span className="font-mono text-xs text-muted-foreground">
              reported {formatDate(currentFiling.filed_at)}
            </span>
          </div>
        )}
      </PageHeader>

      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8 md:px-6">
        <Link
          href="/institutions"
          className="inline-flex items-center gap-1.5 self-start text-sm font-medium text-primary hover:underline"
        >
          <ArrowLeft className="size-4" aria-hidden="true" /> All institutions
        </Link>

        {filings.length === 0 ? (
          <p className="rounded-lg border bg-card px-5 py-12 text-center text-sm text-muted-foreground">
            No 13F filings ingested yet for this institution.
          </p>
        ) : (
          <>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Reporting period">
              {filings.map((f) => {
                const active = f.period_of_report === period;
                return (
                  <Link
                    key={f.accession_no}
                    href={`/institutions/${slug}?q=${f.period_of_report}`}
                    aria-current={active ? "true" : undefined}
                    className={cn(
                      "rounded-md border bg-card px-3 py-1.5 font-mono text-xs font-medium text-muted-foreground transition-colors hover:text-foreground",
                      active &&
                        "border-primary bg-primary text-primary-foreground hover:text-primary-foreground",
                    )}
                  >
                    {formatDate(f.period_of_report)}
                  </Link>
                );
              })}
            </div>

            <div className="overflow-x-auto rounded-lg border bg-card">
              <table className="w-full min-w-[720px] text-sm">
                <thead className="border-b bg-secondary/60 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th scope="col" className="px-5 py-2.5 text-left font-medium">Holding</th>
                    <th scope="col" className="px-5 py-2.5 text-left font-medium">Change</th>
                    <th scope="col" className="px-5 py-2.5 text-right font-medium">Shares</th>
                    <th scope="col" className="px-5 py-2.5 text-right font-medium">Δ Shares</th>
                    <th scope="col" className="px-5 py-2.5 text-right font-medium">Value</th>
                    <th scope="col" className="px-5 py-2.5 text-right font-medium">% of portfolio</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {holdings.map((h) => (
                    <tr key={h.cusip}>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <TickerLogo symbol={h.ticker} name={h.issuer_name} size="sm" />
                          <div className="flex min-w-0 flex-col">
                            {h.ticker ? (
                              <Link
                                href={`/stocks/${h.ticker}`}
                                className="font-mono font-semibold hover:underline"
                              >
                                {h.ticker}
                              </Link>
                            ) : (
                              <span className="font-mono font-semibold text-muted-foreground">
                                {h.cusip}
                              </span>
                            )}
                            <span className="max-w-[240px] truncate text-xs text-muted-foreground">
                              {h.issuer_name}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <HoldingChangeTag change={h.change} />
                      </td>
                      <td className="px-5 py-3.5 text-right font-mono tabular-nums">
                        {formatShares(h.shares)}
                      </td>
                      <td className="px-5 py-3.5 text-right font-mono text-xs tabular-nums">
                        {h.pct_change_shares != null ? (
                          <span className={h.pct_change_shares >= 0 ? "text-buy" : "text-sell"}>
                            {h.pct_change_shares > 0 ? "+" : ""}
                            {h.pct_change_shares}%
                          </span>
                        ) : h.change === "new" ? (
                          <span className="text-primary">new</span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-right font-mono font-semibold tabular-nums">
                        {formatMoney(h.value)}
                      </td>
                      <td className="px-5 py-3.5 text-right font-mono text-xs tabular-nums text-muted-foreground">
                        {totalValue > 0
                          ? `${((h.value / totalValue) * 100).toFixed(1)}%`
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {holdings.length === 0 && (
                <p className="px-5 py-12 text-center text-sm text-muted-foreground">
                  No holdings for this period.
                </p>
              )}
            </div>
          </>
        )}
      </div>
    </main>
  );
}

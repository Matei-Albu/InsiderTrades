import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getHoldingChanges,
  getInstitutionBySlug,
  getInstitutionFilings,
} from "@/lib/queries";
import { formatDate, formatMoney, formatShares } from "@/lib/format";

export const dynamic = "force-dynamic";

const changeStyles: Record<string, string> = {
  new: "bg-accent/15 text-accent",
  added: "bg-gain/15 text-gain",
  trimmed: "bg-loss/15 text-loss",
  unchanged: "bg-surface-2 text-muted",
};

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
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{institution.name}</h1>
          {institution.manager && (
            <p className="mt-1 text-sm text-muted">{institution.manager}</p>
          )}
        </div>
        {currentFiling && (
          <div className="text-right">
            <div className="font-mono text-xl font-semibold">
              {formatMoney(currentFiling.total_value)}
            </div>
            <div className="text-xs text-muted">
              reported {formatDate(currentFiling.filed_at)}
            </div>
          </div>
        )}
      </div>

      {filings.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface p-10 text-center text-muted">
          No 13F filings ingested yet for this institution.
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-1.5">
            {filings.map((f) => (
              <Link
                key={f.accession_no}
                href={`/institutions/${slug}?q=${f.period_of_report}`}
                className={`rounded-md border px-3 py-1.5 text-xs transition-colors ${
                  f.period_of_report === period
                    ? "border-accent bg-accent/10 font-medium text-accent"
                    : "border-border bg-surface text-muted hover:text-foreground"
                }`}
              >
                {formatDate(f.period_of_report)}
              </Link>
            ))}
          </div>

          <div className="overflow-x-auto rounded-xl border border-border bg-surface">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
                  <th className="px-4 py-3">Holding</th>
                  <th className="px-4 py-3">Change</th>
                  <th className="px-4 py-3 text-right">Shares</th>
                  <th className="px-4 py-3 text-right">Δ Shares</th>
                  <th className="px-4 py-3 text-right">Value</th>
                  <th className="px-4 py-3 text-right">% of portfolio</th>
                </tr>
              </thead>
              <tbody>
                {holdings.map((h) => (
                  <tr
                    key={h.cusip}
                    className="border-b border-border/60 last:border-0 hover:bg-surface-2"
                  >
                    <td className="px-4 py-3">
                      {h.ticker ? (
                        <Link
                          href={`/stocks/${h.ticker}`}
                          className="font-mono font-semibold text-accent hover:underline"
                        >
                          {h.ticker}
                        </Link>
                      ) : (
                        <span className="font-mono text-muted">{h.cusip}</span>
                      )}
                      <div className="max-w-[240px] truncate text-xs text-muted">
                        {h.issuer_name}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded px-1.5 py-0.5 text-[11px] font-medium capitalize ${changeStyles[h.change]}`}
                      >
                        {h.change}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono">
                      {formatShares(h.shares)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs">
                      {h.pct_change_shares != null ? (
                        <span className={h.pct_change_shares >= 0 ? "text-gain" : "text-loss"}>
                          {h.pct_change_shares > 0 ? "+" : ""}
                          {h.pct_change_shares}%
                        </span>
                      ) : h.change === "new" ? (
                        <span className="text-accent">new</span>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-medium">
                      {formatMoney(h.value)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs text-muted">
                      {totalValue > 0 ? `${((h.value / totalValue) * 100).toFixed(1)}%` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

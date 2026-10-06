import { fetchYahooQuote, type CompanyQuote } from "@/lib/prices/yahoo";
import {
  formatCompactNumber,
  formatMarketCap,
  formatPercent,
  formatPrice,
  formatRatio,
} from "@/lib/format";

function buildStats(quote: CompanyQuote) {
  return [
    { label: "Market cap", value: formatMarketCap(quote.marketCap) },
    { label: "P/E", value: formatRatio(quote.peRatio) },
    { label: "Forward P/E", value: formatRatio(quote.forwardPE) },
    { label: "EPS", value: formatPrice(quote.eps) },
    { label: "Beta", value: formatRatio(quote.beta) },
    { label: "Div yield", value: formatPercent(quote.dividendYield) },
    {
      label: "52W range",
      value:
        quote.fiftyTwoWeekLow != null && quote.fiftyTwoWeekHigh != null
          ? `${formatPrice(quote.fiftyTwoWeekLow)} – ${formatPrice(quote.fiftyTwoWeekHigh)}`
          : "—",
    },
    { label: "Avg volume", value: formatCompactNumber(quote.averageVolume) },
    { label: "Employees", value: formatCompactNumber(quote.employees) },
  ].filter((s) => s.value !== "—");
}

/** Fetches Yahoo fundamentals independently so the stock chart isn't blocked. */
export default async function CompanyAbout({ ticker }: { ticker: string }) {
  const quote = await fetchYahooQuote(ticker);
  const stats = buildStats(quote);
  const hasDescription = Boolean(quote.description);
  if (!hasDescription && stats.length === 0) return null;

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold">About</h2>
      <div className="rounded-lg border bg-card p-4 sm:p-5">
        {hasDescription && (
          <p className="text-sm leading-relaxed text-muted-foreground">
            {quote.description!.length > 520
              ? `${quote.description!.slice(0, 520).trim()}…`
              : quote.description}
            {quote.website && (
              <>
                {" "}
                <a
                  href={
                    quote.website.startsWith("http")
                      ? quote.website
                      : `https://${quote.website}`
                  }
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium text-primary hover:underline"
                >
                  Website
                </a>
              </>
            )}
          </p>
        )}
        {stats.length > 0 && (
          <dl
            className={`grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3 lg:grid-cols-4 ${
              hasDescription ? "mt-4 border-t pt-4" : ""
            }`}
          >
            {stats.map((s) => (
              <div key={s.label}>
                <dt className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                  {s.label}
                </dt>
                <dd className="mt-0.5 font-mono text-sm font-medium tabular-nums">
                  {s.value}
                </dd>
              </div>
            ))}
          </dl>
        )}
      </div>
    </section>
  );
}

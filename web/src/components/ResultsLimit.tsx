import Link from "next/link";

export const RESULT_LIMITS = [5, 10, 25, 50, 100] as const;
export type ResultLimit = (typeof RESULT_LIMITS)[number];
export const DEFAULT_RESULT_LIMIT: ResultLimit = 10;

export function parseResultLimit(
  value: string | string[] | undefined,
  fallback: ResultLimit = DEFAULT_RESULT_LIMIT
): ResultLimit {
  const n = Number(Array.isArray(value) ? value[0] : value);
  return (RESULT_LIMITS as readonly number[]).includes(n)
    ? (n as ResultLimit)
    : fallback;
}

/** Page-size control shown below trade lists. */
export default function ResultsLimit({
  current,
  buildHref,
  shown,
}: {
  current: number;
  buildHref: (limit: number) => string;
  shown: number;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted">
      <span>
        Showing {shown} result{shown === 1 ? "" : "s"}
      </span>
      <div className="flex items-center gap-2">
        <span className="text-xs uppercase tracking-wide">Per page</span>
        <div className="flex rounded-lg border border-border bg-surface p-0.5">
          {RESULT_LIMITS.map((n) => (
            <Link
              key={n}
              href={buildHref(n)}
              scroll={false}
              className={`rounded-md px-2.5 py-1 text-xs transition-colors ${
                current === n
                  ? "bg-surface-2 font-medium text-foreground"
                  : "hover:text-foreground"
              }`}
            >
              {n}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

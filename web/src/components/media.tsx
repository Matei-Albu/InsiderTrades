import Image from "next/image";
import { cn } from "@/lib/utils";
import { codeLabel } from "@/lib/format";

const sizes = {
  sm: "size-8",
  md: "size-10",
  lg: "size-14",
} as const;

type Size = keyof typeof sizes;

/** Brand logos we ship in /public/logos. Anything else gets a monogram. */
const LOGOS: Record<string, string> = {
  AAPL: "apple",
  AMD: "amd",
  AMZN: "amazon",
  AVGO: "broadcom",
  BA: "boeing",
  COIN: "coinbase",
  CRM: "salesforce",
  GOOG: "google",
  GOOGL: "google",
  LMT: "lockheed-martin",
  META: "meta",
  MSFT: "microsoft",
  NFLX: "netflix",
  NVDA: "nvidia",
  ORCL: "oracle",
  PLTR: "palantir",
  SHOP: "shopify",
  TSLA: "tesla",
  UBER: "uber",
  V: "visa",
};

export function TickerLogo({
  symbol,
  name,
  size = "md",
  className,
}: {
  symbol: string | null;
  name: string;
  size?: Size;
  className?: string;
}) {
  const logo = symbol ? LOGOS[symbol.toUpperCase()] : undefined;
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-md border bg-card p-1.5",
        sizes[size],
        className,
      )}
    >
      {logo ? (
        <Image
          src={`/logos/${logo}.svg`}
          alt={`${name} logo`}
          width={40}
          height={40}
          unoptimized
          className="size-full object-contain"
        />
      ) : (
        <span
          aria-hidden="true"
          className="font-mono text-[11px] font-semibold text-primary"
        >
          {(symbol ?? name).slice(0, 2).toUpperCase()}
        </span>
      )}
    </span>
  );
}

export function PersonAvatar({
  name,
  size = "md",
  className,
}: {
  name: string;
  size?: Size;
  className?: string;
}) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <span
      className={cn(
        "relative flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-secondary font-mono text-xs font-semibold text-primary ring-2 ring-card",
        sizes[size],
        className,
      )}
    >
      <span aria-hidden="true">{initials}</span>
      <span className="sr-only">{name}</span>
    </span>
  );
}

/** Form 4 transaction code as a coloured tag: P/S get buy/sell colours, the rest are neutral. */
export function TradeTypeTag({
  code,
  className,
}: {
  code: string | null;
  className?: string;
}) {
  const base =
    "inline-flex items-center rounded-sm px-1.5 py-0.5 font-mono text-[11px] font-semibold uppercase tracking-wider";
  if (code === "P")
    return <span className={cn(base, "bg-buy-soft text-buy", className)}>P · Buy</span>;
  if (code === "S")
    return <span className={cn(base, "bg-sell-soft text-sell", className)}>S · Sell</span>;
  return (
    <span className={cn(base, "bg-secondary text-muted-foreground", className)}>
      {code ? `${code} · ${codeLabel(code)}` : "—"}
    </span>
  );
}

import Image from "next/image";
import FallbackImage from "@/components/FallbackImage";
import { cn } from "@/lib/utils";
import { codeLabel } from "@/lib/format";
import { institutionLogo, stockLogo } from "@/lib/photos";

const sizes = {
  sm: "size-8",
  md: "size-10",
  lg: "size-14",
  xl: "size-20",
} as const;

type Size = keyof typeof sizes;

/** Brand logos we ship in /public/logos. Anything else tries a remote logo, then a monogram. */
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
  const monogram = (
    <span aria-hidden="true" className="font-mono text-[11px] font-semibold text-primary">
      {(symbol ?? name).slice(0, 2).toUpperCase()}
    </span>
  );
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
      ) : symbol ? (
        <FallbackImage
          src={stockLogo(symbol)}
          alt={`${name} logo`}
          className="size-full object-contain"
          fallback={monogram}
        />
      ) : (
        monogram
      )}
    </span>
  );
}

export function InstitutionLogo({
  slug,
  name,
  size = "md",
  className,
}: {
  slug: string | null;
  name: string;
  size?: Size;
  className?: string;
}) {
  const logo = institutionLogo(slug);
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-md border p-1.5",
        logo ? "bg-white" : "bg-card",
        sizes[size],
        className,
      )}
    >
      {logo ? (
        <Image
          src={logo}
          alt={`${name} logo`}
          width={80}
          height={80}
          unoptimized
          className="size-full object-contain"
        />
      ) : (
        <span aria-hidden="true" className="font-mono text-[11px] font-semibold text-primary">
          {name.slice(0, 2).toUpperCase()}
        </span>
      )}
    </span>
  );
}

export function PersonAvatar({
  name,
  src,
  size = "md",
  className,
}: {
  name: string;
  src?: string | null;
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
      {src ? (
        <FallbackImage
          src={src}
          alt=""
          className="size-full object-cover object-top"
          fallback={<span aria-hidden="true">{initials}</span>}
        />
      ) : (
        <span aria-hidden="true">{initials}</span>
      )}
      <span className="sr-only">{name}</span>
    </span>
  );
}

const CHANGE_STYLES = {
  new: "bg-primary text-primary-foreground",
  added: "bg-buy-soft text-buy",
  trimmed: "bg-sell-soft text-sell",
  unchanged: "bg-secondary text-muted-foreground",
} as const;

/** 13F position change (new / added / trimmed / unchanged). */
export function HoldingChangeTag({ change }: { change: keyof typeof CHANGE_STYLES }) {
  return (
    <span
      className={cn(
        "rounded-sm px-1.5 py-0.5 font-mono text-[11px] font-semibold uppercase tracking-wider",
        CHANGE_STYLES[change],
      )}
    >
      {change}
    </span>
  );
}

export function PartyTag({
  party,
  state,
}: {
  party: string | null;
  state: string | null;
}) {
  if (!party) return null;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-sm border px-1.5 py-0.5 font-mono text-[11px] font-medium",
        party === "D" && "border-primary/30 text-primary",
        party === "R" && "border-sell/30 text-sell",
        party !== "D" && party !== "R" && "text-muted-foreground",
      )}
    >
      {state ? `${party}-${state}` : party}
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

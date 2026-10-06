import { cn } from "@/lib/utils";

export type TapeItem = {
  key: string;
  symbol: string;
  who: string;
  type: "Buy" | "Sell";
  amount: string;
};

function TapeRow({ items, hidden }: { items: TapeItem[]; hidden?: boolean }) {
  return (
    <ul className="flex shrink-0 items-center" aria-hidden={hidden}>
      {items.map((item) => (
        <li
          key={item.key}
          className="flex items-center gap-2 border-r border-primary-foreground/15 px-5 font-mono text-xs whitespace-nowrap"
        >
          <span className="font-semibold">{item.symbol}</span>
          <span className="text-primary-foreground/70">{item.who}</span>
          <span
            className={cn(
              "font-semibold",
              item.type === "Buy" ? "text-buy-soft" : "text-sell-soft",
            )}
          >
            {item.type === "Buy" ? "▲" : "▼"} {item.amount}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Scrolling strip of the latest filings. Two copies side by side give a seamless loop. */
export default function TickerTape({ items }: { items: TapeItem[] }) {
  if (items.length === 0) return null;
  return (
    <div
      className="overflow-hidden bg-primary py-2.5 text-primary-foreground"
      aria-label="Latest filings ticker"
    >
      <div className="flex w-max animate-tape motion-reduce:animate-none">
        <TapeRow items={items} />
        <TapeRow items={items} hidden />
      </div>
    </div>
  );
}

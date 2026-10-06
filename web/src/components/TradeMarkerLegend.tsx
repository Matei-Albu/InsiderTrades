import { formatDate, formatMoney } from "@/lib/format";

export type TradeMarkerItem = {
  date: string;
  side: "buy" | "sell";
  insider: string;
  value: number | null;
};

export default function TradeMarkerLegend({ items }: { items: TradeMarkerItem[] }) {
  if (items.length === 0) return null;

  // Show the most recent handful; full history is in the table below.
  const recent = items.slice(0, 8);

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {recent.map((item, i) => (
        <span
          key={`${item.date}-${item.insider}-${i}`}
          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs ${
            item.side === "buy"
              ? "border-buy/30 bg-buy-soft text-buy"
              : "border-sell/30 bg-sell-soft text-sell"
          }`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              item.side === "buy" ? "bg-buy" : "bg-sell"
            }`}
          />
          <span className="font-medium">{item.insider.split(" ")[0]}</span>
          <span className="text-muted-foreground">{formatMoney(item.value)}</span>
          <span className="text-muted-foreground/70">{formatDate(item.date)}</span>
        </span>
      ))}
      {items.length > recent.length && (
        <span className="self-center text-xs text-muted-foreground">
          +{items.length - recent.length} more in table below
        </span>
      )}
    </div>
  );
}

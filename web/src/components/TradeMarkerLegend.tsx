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
              ? "border-gain/30 bg-gain/10 text-gain"
              : "border-loss/30 bg-loss/10 text-loss"
          }`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              item.side === "buy" ? "bg-gain" : "bg-loss"
            }`}
          />
          <span className="font-medium">{item.insider.split(" ")[0]}</span>
          <span className="text-muted">{formatMoney(item.value)}</span>
          <span className="text-muted/70">{formatDate(item.date)}</span>
        </span>
      ))}
      {items.length > recent.length && (
        <span className="self-center text-xs text-muted">
          +{items.length - recent.length} more in table below
        </span>
      )}
    </div>
  );
}

import Link from "next/link";
import { cn } from "@/lib/utils";

/** URL-driven segmented control: each option is a link, so filters live in the query string. */
export default function SegmentedLinks({
  label,
  options,
}: {
  label: string;
  options: readonly { key: string | number; label: string; href: string; active: boolean }[];
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className="inline-flex rounded-md border bg-card p-0.5"
    >
      {options.map((opt) => (
        <Link
          key={opt.key}
          href={opt.href}
          scroll={false}
          aria-current={opt.active ? "true" : undefined}
          className={cn(
            "rounded-sm px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground",
            opt.active && "bg-primary text-primary-foreground hover:text-primary-foreground",
          )}
        >
          {opt.label}
        </Link>
      ))}
    </div>
  );
}

import Link from "next/link";

export default function Brand() {
  return (
    <Link href="/" className="flex items-center gap-2" aria-label="InsiderTrades home">
      <span className="flex size-8 items-center justify-center rounded-md bg-primary font-mono text-sm font-semibold text-primary-foreground">
        IT
      </span>
      <span className="text-base font-semibold tracking-tight">InsiderTrades</span>
    </Link>
  );
}

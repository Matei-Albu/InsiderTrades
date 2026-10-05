"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Star } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

export default function WatchButton({
  ticker,
  initialWatching,
  signedIn,
  variant = "full",
  className,
}: {
  ticker: string;
  initialWatching: boolean;
  signedIn: boolean;
  /** "full" is the labelled button; "icon" is a compact star for list rows. */
  variant?: "full" | "icon";
  className?: string;
}) {
  const router = useRouter();
  const [watching, setWatching] = useState(initialWatching);
  const [pending, startTransition] = useTransition();

  function toggle() {
    if (!signedIn) {
      router.push("/login");
      return;
    }
    startTransition(async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }
      if (watching) {
        const { error } = await supabase
          .from("watchlists")
          .delete()
          .eq("user_id", user.id)
          .eq("ticker", ticker);
        if (!error) setWatching(false);
      } else {
        const { error } = await supabase
          .from("watchlists")
          .insert({ user_id: user.id, ticker });
        if (!error) setWatching(true);
      }
      router.refresh();
    });
  }

  if (variant === "icon") {
    return (
      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        aria-pressed={watching}
        aria-label={
          watching ? `Remove ${ticker} from watchlist` : `Add ${ticker} to watchlist`
        }
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:opacity-50",
          watching && "text-primary",
          className,
        )}
      >
        <Star className={cn("size-4", watching && "fill-current")} />
      </button>
    );
  }

  return (
    <button
      onClick={toggle}
      disabled={pending}
      className={`rounded-md px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50 ${
        watching
          ? "border border-border bg-surface text-muted hover:text-loss"
          : "bg-accent text-white hover:opacity-90"
      }`}
    >
      {watching ? "★ Watching" : "☆ Watch"}
    </button>
  );
}

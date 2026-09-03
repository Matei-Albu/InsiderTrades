"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";

export default function WatchButton({
  ticker,
  initialWatching,
  signedIn,
}: {
  ticker: string;
  initialWatching: boolean;
  signedIn: boolean;
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

"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";

export default function AddTickerForm() {
  const router = useRouter();
  const [ticker, setTicker] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const symbol = ticker.trim().toUpperCase();
    if (!/^[A-Z.\-]{1,10}$/.test(symbol)) {
      setError("Enter a valid ticker symbol.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }
      const { error } = await supabase
        .from("watchlists")
        .insert({ user_id: user.id, ticker: symbol });
      if (error && !error.message.includes("duplicate")) {
        setError(error.message);
        return;
      }
      setTicker("");
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="flex max-w-sm gap-2">
      <input
        value={ticker}
        onChange={(e) => setTicker(e.target.value)}
        placeholder="Add ticker, e.g. NVDA"
        className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm outline-none placeholder:text-muted focus:border-accent"
      />
      <button
        type="submit"
        disabled={pending || !ticker.trim()}
        className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        Add
      </button>
      {error && <p className="self-center text-xs text-loss">{error}</p>}
    </form>
  );
}

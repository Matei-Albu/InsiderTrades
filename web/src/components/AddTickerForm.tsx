"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
    <form onSubmit={submit} className="flex flex-col gap-2">
      <div className="flex gap-2">
        <Input
          value={ticker}
          onChange={(e) => setTicker(e.target.value)}
          placeholder="Add ticker, e.g. NVDA"
          aria-label="Ticker symbol"
          className="h-9 w-56 bg-card font-mono uppercase placeholder:font-sans placeholder:normal-case"
        />
        <Button type="submit" disabled={pending || !ticker.trim()} className="h-9 px-3">
          <Plus /> Add
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-xs text-sell">
          {error}
        </p>
      )}
    </form>
  );
}

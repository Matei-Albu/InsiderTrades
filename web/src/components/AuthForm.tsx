"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Brand from "@/components/Brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const MODES = [
  { key: "signin", label: "Sign in" },
  { key: "signup", label: "Create account" },
] as const;

export default function AuthForm() {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const isSignUp = mode === "signup";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    const supabase = createClient();

    if (mode === "signup") {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${location.origin}/auth/callback` },
      });
      if (error) {
        setError(error.message);
      } else {
        setMessage("Check your email to confirm your account.");
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setError(error.message);
      } else {
        router.push("/watchlist");
        router.refresh();
        return;
      }
    }
    setBusy(false);
  }

  return (
    <main className="mx-auto grid w-full max-w-6xl gap-0 px-4 py-10 md:px-6 lg:grid-cols-2 lg:py-16">
      <div className="flex flex-col justify-center gap-8 rounded-l-lg border bg-card p-8 max-lg:rounded-lg md:p-12">
        <div className="flex flex-col gap-3">
          <Brand />
          <h1 className="text-balance text-3xl font-semibold tracking-tight">
            {isSignUp ? "Start tracking smart money" : "Welcome back"}
          </h1>
          <p className="leading-relaxed text-muted-foreground">
            {isSignUp
              ? "Free account. Get an email when a filing hits for any ticker you watch."
              : "Sign in to see your watchlist and filing alerts."}
          </p>
        </div>

        <form onSubmit={submit} className="flex flex-col gap-4">
          <div
            role="group"
            aria-label="Sign in or create account"
            className="inline-flex self-start rounded-md border bg-card p-0.5"
          >
            {MODES.map((m) => (
              <button
                key={m.key}
                type="button"
                aria-pressed={mode === m.key}
                onClick={() => setMode(m.key)}
                className={cn(
                  "rounded-sm px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground",
                  mode === m.key &&
                    "bg-primary text-primary-foreground hover:text-primary-foreground",
                )}
              >
                {m.label}
              </button>
            ))}
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="email" className="text-sm font-medium">
              Email
            </label>
            <Input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="h-10"
            />
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="password" className="text-sm font-medium">
              Password
            </label>
            <Input
              id="password"
              type="password"
              required
              minLength={6}
              autoComplete={isSignUp ? "new-password" : "current-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 6 characters"
              className="h-10"
            />
          </div>

          {error && (
            <p role="alert" className="text-sm text-sell">
              {error}
            </p>
          )}
          {message && <p className="text-sm text-buy">{message}</p>}

          <Button type="submit" size="lg" disabled={busy} className="mt-2 h-10">
            {busy ? "Working…" : isSignUp ? "Create account" : "Sign in"}
          </Button>
        </form>
      </div>

      <div className="relative hidden overflow-hidden rounded-r-lg border border-l-0 bg-primary text-primary-foreground lg:flex lg:items-end">
        <figure className="flex flex-col gap-3 p-10">
          <blockquote className="text-pretty text-2xl font-medium leading-snug">
            &ldquo;Insiders might sell their shares for any number of reasons, but they
            buy them for only one.&rdquo;
          </blockquote>
          <figcaption className="font-mono text-xs uppercase tracking-wider text-primary-foreground/70">
            — Peter Lynch
          </figcaption>
        </figure>
      </div>
    </main>
  );
}

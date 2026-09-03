import type { Metadata } from "next";
import AuthForm from "@/components/AuthForm";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <div className="mx-auto mt-12 w-full max-w-sm">
      <h1 className="text-2xl font-semibold tracking-tight">Welcome</h1>
      <p className="mt-1 text-sm text-muted">
        Sign in to build a watchlist and get insider trade alerts by email.
      </p>
      <AuthForm />
    </div>
  );
}

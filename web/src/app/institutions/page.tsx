import Link from "next/link";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getInstitutions } from "@/lib/queries";
import { formatDate, formatMoney } from "@/lib/format";
import type { Filing13F } from "@/lib/types";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Institutions" };

export default async function InstitutionsPage() {
  const institutions = await getInstitutions();

  // Latest filing per institution for the summary cards.
  const supabase = await createClient();
  const { data: filings } = await supabase
    .from("filings_13f")
    .select("*")
    .order("period_of_report", { ascending: false });
  const latestByCik = new Map<string, Filing13F>();
  for (const f of filings ?? []) {
    if (!latestByCik.has(f.institution_cik)) latestByCik.set(f.institution_cik, f);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Institutions</h1>
        <p className="mt-1 text-sm text-muted">
          Quarterly 13F portfolios of notable funds and family offices.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {institutions.map((inst) => {
          const latest = latestByCik.get(inst.cik);
          return (
            <Link
              key={inst.cik}
              href={`/institutions/${inst.slug}`}
              className="rounded-xl border border-border bg-surface p-5 transition-colors hover:border-accent/50"
            >
              <div className="font-semibold">{inst.name}</div>
              {inst.manager && (
                <div className="mt-0.5 text-sm text-muted">{inst.manager}</div>
              )}
              <dl className="mt-4 space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted">Portfolio value</dt>
                  <dd className="font-mono font-medium">
                    {latest ? formatMoney(latest.total_value) : "—"}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted">As of</dt>
                  <dd className="text-xs">
                    {latest ? formatDate(latest.period_of_report) : "not ingested yet"}
                  </dd>
                </div>
              </dl>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

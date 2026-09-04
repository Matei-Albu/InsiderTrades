import { createClient } from "@/lib/supabase/server";
import { fetchYahooPrices } from "@/lib/prices/yahoo";
import type {
  ClusterBuy,
  Company,
  CongressTrade,
  Filing13F,
  HoldingChange,
  InsiderTrade,
  Institution,
  Politician,
  PriceBar,
} from "@/lib/types";

export type FeedFilter = {
  /** "buys" (code P), "sells" (code S) or "all" */
  side: "buys" | "sells" | "all";
  /** Minimum total transaction value in dollars. */
  minValue: number;
  /** Restrict to a single ticker. */
  ticker?: string;
};

export async function getTrades(filter: FeedFilter, limit = 100): Promise<InsiderTrade[]> {
  const supabase = await createClient();
  let query = supabase
    .from("insider_trades")
    .select("*")
    .order("filed_at", { ascending: false })
    .limit(limit);

  if (filter.side === "buys") query = query.eq("transaction_code", "P");
  if (filter.side === "sells") query = query.eq("transaction_code", "S");
  if (filter.minValue > 0) query = query.gte("total_value", filter.minValue);
  if (filter.ticker) query = query.eq("ticker", filter.ticker.toUpperCase());

  const { data, error } = await query;
  if (error) throw new Error(`insider_trades: ${error.message}`);
  return data ?? [];
}

export async function getClusterBuys(): Promise<ClusterBuy[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("cluster_buys")
    .select("*")
    .order("total_value", { ascending: false });
  if (error) throw new Error(`cluster_buys: ${error.message}`);
  return data ?? [];
}

/** Tickers currently in a cluster-buy window, for feed badges. */
export async function getClusterTickers(): Promise<Set<string>> {
  const clusters = await getClusterBuys();
  return new Set(clusters.map((c) => c.ticker).filter((t): t is string => !!t));
}

export async function getInstitutions(): Promise<Institution[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("institutions")
    .select("*")
    .order("name");
  if (error) throw new Error(`institutions: ${error.message}`);
  return data ?? [];
}

export async function getInstitutionBySlug(slug: string): Promise<Institution | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("institutions")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw new Error(`institutions: ${error.message}`);
  return data;
}

export async function getInstitutionFilings(cik: string): Promise<Filing13F[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("filings_13f")
    .select("*")
    .eq("institution_cik", cik)
    .order("period_of_report", { ascending: false });
  if (error) throw new Error(`filings_13f: ${error.message}`);
  return data ?? [];
}

export async function getHoldingChanges(
  cik: string,
  period: string
): Promise<HoldingChange[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("holdings_13f_changes")
    .select("*")
    .eq("institution_cik", cik)
    .eq("period_of_report", period)
    .order("value", { ascending: false });
  if (error) throw new Error(`holdings_13f_changes: ${error.message}`);
  return data ?? [];
}

export async function getCompanyByTicker(ticker: string): Promise<Company | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("companies")
    .select("cik, ticker, name")
    .eq("ticker", ticker.toUpperCase())
    .limit(1);
  if (error) throw new Error(`companies: ${error.message}`);
  return data?.[0] ?? null;
}

/**
 * Resolve a ticker to company metadata. The companies table only contains
 * issuers with Form 4 filings; 13F holdings may reference tickers we have
 * never ingested as insiders (e.g. AAPL on Berkshire's portfolio).
 */
export async function resolveCompany(ticker: string): Promise<Company | null> {
  const normalized = ticker.toUpperCase();
  const fromCompanies = await getCompanyByTicker(normalized);
  if (fromCompanies) return fromCompanies;

  const supabase = await createClient();

  const { data: trade, error: tradeErr } = await supabase
    .from("insider_trades")
    .select("company_cik, ticker, company_name")
    .eq("ticker", normalized)
    .limit(1);
  if (tradeErr) throw new Error(`insider_trades: ${tradeErr.message}`);
  if (trade?.[0]) {
    return {
      cik: trade[0].company_cik,
      ticker: trade[0].ticker!,
      name: trade[0].company_name,
    };
  }

  const { data: holding, error: holdingErr } = await supabase
    .from("holdings_13f")
    .select("ticker, issuer_name")
    .eq("ticker", normalized)
    .limit(1);
  if (holdingErr) throw new Error(`holdings_13f: ${holdingErr.message}`);
  if (holding?.[0]) {
    return {
      cik: normalized, // no SEC issuer CIK until we ingest a Form 4
      ticker: holding[0].ticker!,
      name: holding[0].issuer_name,
    };
  }

  return null;
}

export async function getPrices(ticker: string): Promise<PriceBar[]> {
  const normalized = ticker.toUpperCase();

  // Always try Yahoo for a full 5-year window; DB may only have a recent slice
  // from the ingester batch job.
  const [yahoo, db] = await Promise.all([
    fetchYahooPrices(normalized),
    (async () => {
      const supabase = await createClient();
      const { data, error } = await supabase
        .from("prices")
        .select("*")
        .eq("ticker", normalized)
        .order("date", { ascending: true })
        .limit(1500);
      if (error) throw new Error(`prices: ${error.message}`);
      return data ?? [];
    })(),
  ]);

  // Prefer whichever source has more history.
  if (yahoo.length >= db.length) return yahoo;
  return db;
}

/** Institutions holding a ticker in their most recent filed quarter. */
export async function getInstitutionalOwners(ticker: string): Promise<
  { institution: Institution; shares: number; value: number; period: string }[]
> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("holdings_13f")
    .select("institution_cik, period_of_report, shares, value, institutions(cik, name, slug, manager)")
    .eq("ticker", ticker.toUpperCase())
    .order("period_of_report", { ascending: false })
    .limit(200);
  if (error) throw new Error(`holdings_13f: ${error.message}`);

  // Keep only each institution's latest period, summing multi-line holdings.
  const latest = new Map<string, { institution: Institution; shares: number; value: number; period: string }>();
  for (const row of data ?? []) {
    const inst = row.institutions as unknown as Institution;
    const existing = latest.get(row.institution_cik);
    if (!existing) {
      latest.set(row.institution_cik, {
        institution: inst,
        shares: row.shares ?? 0,
        value: row.value ?? 0,
        period: row.period_of_report,
      });
    } else if (existing.period === row.period_of_report) {
      existing.shares += row.shares ?? 0;
      existing.value += row.value ?? 0;
    }
  }
  return [...latest.values()].sort((a, b) => b.value - a.value);
}

export type CongressFilter = {
  side: "buys" | "sells" | "all";
  politician?: string; // slug
};

export async function getPoliticians(): Promise<Politician[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("politicians")
    .select("*")
    .eq("active", true)
    .order("name");
  if (error) throw new Error(`politicians: ${error.message}`);
  return data ?? [];
}

export async function getCongressTrades(
  filter: CongressFilter,
  limit = 100
): Promise<CongressTrade[]> {
  const supabase = await createClient();
  let query = supabase
    .from("congress_trade_feed")
    .select("*")
    .order("filed_at", { ascending: false })
    .limit(limit);

  if (filter.side === "buys") query = query.eq("transaction_type", "purchase");
  if (filter.side === "sells") query = query.eq("transaction_type", "sale");
  if (filter.politician) query = query.eq("politician_slug", filter.politician);

  const { data, error } = await query;
  if (error) throw new Error(`congress_trade_feed: ${error.message}`);
  return data ?? [];
}

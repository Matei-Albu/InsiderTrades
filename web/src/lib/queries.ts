import { createClient } from "@/lib/supabase/server";
import { fetchYahooPrices } from "@/lib/prices/yahoo";
import { filterBarsToRange, type ChartRangeKey } from "@/lib/prices/range";
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
  /** Free-text match on ticker, company name or insider name. */
  search?: string;
};

/**
 * Strip everything that could alter a PostgREST `or()` filter (commas, parens,
 * wildcards, dots-as-operators are harmless but we keep only name-ish chars).
 */
export function sanitizeSearch(raw: string | undefined): string {
  return (raw ?? "").replace(/[^a-zA-Z0-9 '\-]/g, "").trim().slice(0, 40);
}

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
  const search = sanitizeSearch(filter.search);
  if (search) {
    query = query.or(
      `ticker.ilike.${search}%,insider_name.ilike.%${search}%,company_name.ilike.%${search}%`,
    );
  }

  const { data, error } = await query;
  if (error) throw new Error(`insider_trades: ${error.message}`);
  return data ?? [];
}

/** Current user plus the tickers on their watchlist (empty set when signed out). */
export async function getUserWatchlist() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  let watched = new Set<string>();
  if (user) {
    const { data } = await supabase.from("watchlists").select("ticker");
    watched = new Set((data ?? []).map((w) => w.ticker));
  }
  return { user, watched };
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

/**
 * The open-market buys behind each current cluster, grouped by ticker, so cards
 * can list which insiders bought. Only buys inside that cluster's own window.
 */
export async function getClusterInsiders(
  clusters: ClusterBuy[],
): Promise<Map<string, InsiderTrade[]>> {
  const byTicker = new Map<string, InsiderTrade[]>();
  const live = clusters.filter((c): c is ClusterBuy & { ticker: string } => !!c.ticker);
  if (live.length === 0) return byTicker;

  const since = live.map((c) => c.first_buy).sort()[0];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("insider_trades")
    .select("*")
    .in("ticker", live.map((c) => c.ticker))
    .eq("transaction_code", "P")
    .gte("transaction_date", since)
    .order("total_value", { ascending: false })
    .limit(1000);
  if (error) throw new Error(`insider_trades: ${error.message}`);

  const windowStart = new Map(live.map((c) => [c.ticker, c.first_buy]));
  for (const t of data ?? []) {
    if (!t.ticker || !t.transaction_date) continue;
    if (t.transaction_date < (windowStart.get(t.ticker) ?? "")) continue;
    const list = byTicker.get(t.ticker) ?? [];
    list.push(t);
    byTicker.set(t.ticker, list);
  }
  return byTicker;
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

export type InstitutionMove = HoldingChange & {
  institution_name: string;
  institution_slug: string | null;
};

/**
 * Biggest recent position changes (new / added / trimmed) across all tracked
 * institutions, for the homepage. Newest quarter first, then by position size.
 */
export async function getLatestInstitutionMoves(
  limit = 3,
  change?: "new" | "added" | "trimmed",
): Promise<InstitutionMove[]> {
  const supabase = await createClient();
  const [{ data, error }, institutions] = await Promise.all([
    supabase
      .from("holdings_13f_changes")
      .select("*")
      .in("change", change ? [change] : ["new", "added", "trimmed"])
      .not("ticker", "is", null)
      .order("period_of_report", { ascending: false })
      .order("value", { ascending: false })
      .limit(limit),
    getInstitutions(),
  ]);
  if (error) throw new Error(`holdings_13f_changes: ${error.message}`);
  const byCik = new Map(institutions.map((i) => [i.cik, i]));
  return (data ?? []).map((m: HoldingChange) => ({
    ...m,
    institution_name: byCik.get(m.institution_cik)?.name ?? "Institution",
    institution_slug: byCik.get(m.institution_cik)?.slug ?? null,
  }));
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

export async function getPrices(
  ticker: string,
  range: ChartRangeKey = "all"
): Promise<PriceBar[]> {
  const normalized = ticker.toUpperCase();

  // Intraday must come from Yahoo; fall back to last daily bar(s) if empty.
  if (range === "1d") {
    const intraday = await fetchYahooPrices(normalized, "1d");
    if (intraday.length > 0) return intraday;
    const daily = await loadDailyHistory(normalized);
    return daily.slice(-5); // last few sessions if 5m feed is empty
  }

  const daily = await loadDailyHistory(normalized);
  return filterBarsToRange(daily, range);
}

async function loadDailyHistory(ticker: string): Promise<PriceBar[]> {
  const [yahoo, db] = await Promise.all([
    fetchYahooPrices(ticker, "all").catch(() => [] as PriceBar[]),
    (async () => {
      const supabase = await createClient();
      const { data, error } = await supabase
        .from("prices")
        .select("*")
        .eq("ticker", ticker)
        .order("date", { ascending: true })
        .limit(1500);
      if (error) throw new Error(`prices: ${error.message}`);
      return (data ?? []) as PriceBar[];
    })(),
  ]);

  // Prefer the longer series (Yahoo 5y usually wins; DB is the offline fallback).
  if (yahoo.length >= db.length && yahoo.length > 0) return yahoo;
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
  party?: "D" | "R";
};

/** Disclosure counts per member over the last `days`, for the "most active" tiles. */
export async function getCongressActivity(days = 90): Promise<Map<string, number>> {
  const supabase = await createClient();
  const since = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from("congress_trade_feed")
    .select("politician_slug")
    .gte("filed_at", since)
    .limit(5000);
  if (error) throw new Error(`congress_trade_feed: ${error.message}`);
  const counts = new Map<string, number>();
  for (const row of data ?? []) {
    counts.set(row.politician_slug, (counts.get(row.politician_slug) ?? 0) + 1);
  }
  return counts;
}

export type WatchlistActivity = {
  company: string | null;
  congress: number;
  institutions: number;
};

/** Per-ticker context for watchlist cards: company name, congress trades, 13F holders. */
export async function getWatchlistActivity(
  tickers: string[],
): Promise<Map<string, WatchlistActivity>> {
  const out = new Map<string, WatchlistActivity>(
    tickers.map((t) => [t, { company: null, congress: 0, institutions: 0 }]),
  );
  if (tickers.length === 0) return out;

  const supabase = await createClient();
  const [companies, congress, holdings] = await Promise.all([
    supabase.from("companies").select("ticker, name").in("ticker", tickers),
    supabase.from("congress_trade_feed").select("ticker").in("ticker", tickers).limit(5000),
    supabase
      .from("holdings_13f")
      .select("ticker, institution_cik")
      .in("ticker", tickers)
      .limit(5000),
  ]);

  for (const c of companies.data ?? []) {
    if (c.ticker && out.has(c.ticker)) out.get(c.ticker)!.company = c.name;
  }
  for (const c of congress.data ?? []) {
    if (c.ticker && out.has(c.ticker)) out.get(c.ticker)!.congress += 1;
  }
  const holders = new Map<string, Set<string>>();
  for (const h of holdings.data ?? []) {
    if (!h.ticker) continue;
    const set = holders.get(h.ticker) ?? new Set<string>();
    set.add(h.institution_cik);
    holders.set(h.ticker, set);
  }
  for (const [t, set] of holders) {
    if (out.has(t)) out.get(t)!.institutions = set.size;
  }
  return out;
}

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
  if (filter.party) query = query.eq("party", filter.party);

  const { data, error } = await query;
  if (error) throw new Error(`congress_trade_feed: ${error.message}`);
  return data ?? [];
}

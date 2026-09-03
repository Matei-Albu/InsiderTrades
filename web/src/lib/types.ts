/** Row shapes returned by the Supabase views/tables the UI reads. */

export type InsiderTrade = {
  id: number;
  accession_no: string;
  transaction_date: string | null;
  transaction_code: string | null;
  acquired_disposed: string | null;
  shares: number | null;
  price_per_share: number | null;
  total_value: number | null;
  shares_owned_after: number | null;
  security_title: string | null;
  filed_at: string;
  insider_cik: string;
  insider_name: string;
  insider_title: string | null;
  is_director: boolean;
  is_officer: boolean;
  is_ten_percent_owner: boolean;
  source_url: string | null;
  company_cik: string;
  ticker: string | null;
  company_name: string;
  pct_holdings_increase: number | null;
};

export type ClusterBuy = {
  company_cik: string;
  ticker: string | null;
  company_name: string;
  insider_count: number;
  total_value: number | null;
  total_shares: number | null;
  first_buy: string;
  last_buy: string;
};

export type Institution = {
  cik: string;
  name: string;
  slug: string;
  manager: string | null;
};

export type Filing13F = {
  accession_no: string;
  institution_cik: string;
  period_of_report: string;
  filed_at: string;
  total_value: number | null;
};

export type HoldingChange = {
  institution_cik: string;
  period_of_report: string;
  cusip: string;
  ticker: string | null;
  issuer_name: string;
  value: number;
  shares: number;
  prev_shares: number | null;
  prev_value: number | null;
  change: "new" | "added" | "trimmed" | "unchanged";
  pct_change_shares: number | null;
};

export type PriceBar = {
  ticker: string;
  date: string;
  open: number | null;
  high: number | null;
  low: number | null;
  close: number | null;
  volume: number | null;
};

export type Company = {
  cik: string;
  ticker: string | null;
  name: string;
};

export type WatchlistItem = {
  id: string;
  ticker: string;
  created_at: string;
};

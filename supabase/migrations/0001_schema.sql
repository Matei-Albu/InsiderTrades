-- Core schema for InsiderTrades.
-- Apply via Supabase SQL editor or `supabase db push`.

-- ---------------------------------------------------------------------------
-- Reference data
-- ---------------------------------------------------------------------------

create table if not exists companies (
    cik        text primary key,           -- zero-padded 10-digit CIK
    ticker     text,
    name       text not null,
    updated_at timestamptz not null default now()
);

create index if not exists companies_ticker_idx on companies (ticker);

create table if not exists insiders (
    cik  text primary key,
    name text not null
);

-- ---------------------------------------------------------------------------
-- Form 4 (insider transactions)
-- ---------------------------------------------------------------------------

create table if not exists filings_form4 (
    accession_no         text primary key,
    company_cik          text not null references companies (cik),
    insider_cik          text not null references insiders (cik),
    insider_name         text not null,
    insider_title        text,
    is_director          boolean not null default false,
    is_officer           boolean not null default false,
    is_ten_percent_owner boolean not null default false,
    filed_at             timestamptz not null,
    period_of_report     date,
    source_url           text,
    created_at           timestamptz not null default now()
);

create index if not exists filings_form4_company_idx on filings_form4 (company_cik, filed_at desc);
create index if not exists filings_form4_filed_at_idx on filings_form4 (filed_at desc);

create table if not exists transactions (
    id                 bigint generated always as identity primary key,
    accession_no       text not null references filings_form4 (accession_no) on delete cascade,
    transaction_date   date,
    transaction_code   text,               -- P = open-market buy, S = sale, A = award, M = option exercise, ...
    acquired_disposed  text,               -- A or D
    shares             numeric,
    price_per_share    numeric,
    total_value        numeric,            -- shares * price, precomputed by the ingester
    shares_owned_after numeric,
    security_title     text,
    is_derivative      boolean not null default false
);

create index if not exists transactions_accession_idx on transactions (accession_no);
create index if not exists transactions_code_date_idx on transactions (transaction_code, transaction_date desc);

-- ---------------------------------------------------------------------------
-- 13F (institutional holdings)
-- ---------------------------------------------------------------------------

create table if not exists institutions (
    cik     text primary key,
    name    text not null,
    slug    text not null unique,          -- URL slug, e.g. "berkshire-hathaway"
    manager text                           -- display name, e.g. "Warren Buffett"
);

create table if not exists filings_13f (
    accession_no     text primary key,
    institution_cik  text not null references institutions (cik),
    period_of_report date not null,        -- quarter end
    filed_at         timestamptz not null,
    total_value      numeric,              -- summed from holdings, in dollars
    created_at       timestamptz not null default now(),
    unique (institution_cik, period_of_report)
);

create table if not exists holdings_13f (
    id               bigint generated always as identity primary key,
    accession_no     text not null references filings_13f (accession_no) on delete cascade,
    institution_cik  text not null references institutions (cik),
    period_of_report date not null,
    cusip            text not null,
    ticker           text,                 -- resolved from CUSIP when possible
    issuer_name      text not null,
    class_title      text,
    value            numeric not null,     -- dollars
    shares           numeric not null,
    share_type       text                  -- SH or PRN
);

create index if not exists holdings_13f_inst_period_idx on holdings_13f (institution_cik, period_of_report desc);
create index if not exists holdings_13f_cusip_idx on holdings_13f (cusip);
create index if not exists holdings_13f_ticker_idx on holdings_13f (ticker);

-- ---------------------------------------------------------------------------
-- Prices (EOD, from Yahoo Finance)
-- ---------------------------------------------------------------------------

create table if not exists prices (
    ticker text not null,
    date   date not null,
    open   numeric,
    high   numeric,
    low    numeric,
    close  numeric,
    volume bigint,
    primary key (ticker, date)
);

-- ---------------------------------------------------------------------------
-- Users: watchlists + alert log (RLS-protected)
-- ---------------------------------------------------------------------------

create table if not exists watchlists (
    id         uuid primary key default gen_random_uuid(),
    user_id    uuid not null references auth.users (id) on delete cascade,
    ticker     text not null,
    created_at timestamptz not null default now(),
    unique (user_id, ticker)
);

create table if not exists alert_log (
    id           bigint generated always as identity primary key,
    user_id      uuid not null references auth.users (id) on delete cascade,
    accession_no text not null references filings_form4 (accession_no) on delete cascade,
    ticker       text not null,
    sent_at      timestamptz not null default now(),
    unique (user_id, accession_no)
);

-- ---------------------------------------------------------------------------
-- Ingester bookkeeping
-- ---------------------------------------------------------------------------

create table if not exists ingest_state (
    key        text primary key,
    value      text not null,
    updated_at timestamptz not null default now()
);

-- Row Level Security.
-- Market data tables are world-readable (anon key); user tables are per-user.
-- The Go ingester connects with the direct Postgres role (postgres), which
-- bypasses RLS, so no insert policies are needed for ingestion.

-- Public, read-only market data ---------------------------------------------

alter table companies     enable row level security;
alter table insiders      enable row level security;
alter table filings_form4 enable row level security;
alter table transactions  enable row level security;
alter table institutions  enable row level security;
alter table filings_13f   enable row level security;
alter table holdings_13f  enable row level security;
alter table prices        enable row level security;
alter table ingest_state  enable row level security;

create policy "public read" on companies     for select using (true);
create policy "public read" on insiders      for select using (true);
create policy "public read" on filings_form4 for select using (true);
create policy "public read" on transactions  for select using (true);
create policy "public read" on institutions  for select using (true);
create policy "public read" on filings_13f   for select using (true);
create policy "public read" on holdings_13f  for select using (true);
create policy "public read" on prices        for select using (true);
-- ingest_state: no policies -> not readable by anon/authenticated.

-- Per-user tables ------------------------------------------------------------

alter table watchlists enable row level security;
alter table alert_log  enable row level security;

create policy "own watchlist select" on watchlists
    for select using (auth.uid() = user_id);
create policy "own watchlist insert" on watchlists
    for insert with check (auth.uid() = user_id);
create policy "own watchlist delete" on watchlists
    for delete using (auth.uid() = user_id);

create policy "own alerts select" on alert_log
    for select using (auth.uid() = user_id);

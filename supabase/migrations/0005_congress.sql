-- Congressional STOCK Act Periodic Transaction Reports (House PTRs).
-- Source: disclosures-clerk.house.gov yearly FD index + PTR PDFs.

create table if not exists politicians (
    id          text primary key,          -- stable slug, e.g. "nancy-pelosi"
    name        text not null,
    slug        text not null unique,
    chamber     text not null default 'house', -- house | senate
    party       text,                      -- D | R | I
    state       text,                      -- USPS, e.g. CA
    district    text,                      -- House StateDst, e.g. CA11
    last_name   text not null,             -- FD.xml matching key
    committees  text,                      -- short display note
    active      boolean not null default true
);

create table if not exists filings_congress (
    doc_id         text primary key,       -- House Clerk DocID
    politician_id  text not null references politicians (id),
    year           int not null,
    filed_at       date not null,
    source_url     text not null,
    created_at     timestamptz not null default now()
);

create index if not exists filings_congress_politician_idx
    on filings_congress (politician_id, filed_at desc);

create table if not exists congress_trades (
    id                  bigint generated always as identity primary key,
    doc_id              text not null references filings_congress (doc_id) on delete cascade,
    politician_id       text not null references politicians (id),
    ticker              text,
    asset_name          text not null,
    transaction_type    text not null,     -- purchase | sale | exchange
    transaction_date    date,
    notification_date   date,
    amount_range        text,              -- as disclosed, e.g. $15,001 - $50,000
    amount_min          numeric,           -- lower bound of range
    amount_max          numeric,           -- upper bound (null if "Over $X")
    owner               text,              -- Self | Spouse | Joint | Dependent Child
    asset_type          text,              -- Stock, Options, ETF, ...
    description         text,
    created_at          timestamptz not null default now()
);

create index if not exists congress_trades_filed_idx
    on congress_trades (politician_id, transaction_date desc);
create index if not exists congress_trades_ticker_idx
    on congress_trades (ticker) where ticker is not null;

-- Flat view for the /congress feed.
create or replace view congress_trade_feed as
select
    t.id,
    t.doc_id,
    t.politician_id,
    p.name            as politician_name,
    p.slug            as politician_slug,
    p.chamber,
    p.party,
    p.state,
    p.district,
    p.committees,
    t.ticker,
    t.asset_name,
    t.transaction_type,
    t.transaction_date,
    t.notification_date,
    t.amount_range,
    t.amount_min,
    t.amount_max,
    t.owner,
    t.asset_type,
    t.description,
    f.filed_at,
    f.source_url,
    f.year
from congress_trades t
join politicians p on p.id = t.politician_id
join filings_congress f on f.doc_id = t.doc_id;

alter table politicians      enable row level security;
alter table filings_congress enable row level security;
alter table congress_trades  enable row level security;

create policy "public read" on politicians      for select using (true);
create policy "public read" on filings_congress for select using (true);
create policy "public read" on congress_trades  for select using (true);

-- Curated House members. Match FD.xml via last_name + district (StateDst).
-- Trump / sitting senators are not in the House PTR index — skip for v1.
insert into politicians (id, name, slug, chamber, party, state, district, last_name, committees) values
    ('nancy-pelosi',          'Nancy Pelosi',            'nancy-pelosi',          'house', 'D', 'CA', 'CA11', 'Pelosi',    'Speaker Emerita; Appropriations'),
    ('dan-crenshaw',          'Dan Crenshaw',            'dan-crenshaw',          'house', 'R', 'TX', 'TX02', 'Crenshaw',  'Intelligence; Energy & Commerce'),
    ('marjorie-taylor-greene','Marjorie Taylor Greene',  'marjorie-taylor-greene','house', 'R', 'GA', 'GA14', 'Greene',    'Homeland Security; Oversight'),
    ('josh-gottheimer',       'Josh Gottheimer',         'josh-gottheimer',       'house', 'D', 'NJ', 'NJ05', 'Gottheimer','Financial Services'),
    ('michael-mccaul',        'Michael McCaul',          'michael-mccaul',        'house', 'R', 'TX', 'TX10', 'McCaul',    'Foreign Affairs (former chair)'),
    ('ro-khanna',             'Ro Khanna',               'ro-khanna',             'house', 'D', 'CA', 'CA17', 'Khanna',    'Armed Services; Oversight'),
    ('nancy-mace',            'Nancy Mace',              'nancy-mace',            'house', 'R', 'SC', 'SC01', 'Mace',      'Armed Services; Oversight'),
    ('austin-scott',          'Austin Scott',            'austin-scott',          'house', 'R', 'GA', 'GA08', 'Scott',     'Agriculture; Armed Services'),
    ('patrick-mchenry',       'Patrick McHenry',         'patrick-mchenry',       'house', 'R', 'NC', 'NC10', 'McHenry',   'Financial Services (former chair)'),
    ('chip-roy',              'Chip Roy',                'chip-roy',              'house', 'R', 'TX', 'TX21', 'Roy',       'Judiciary; Budget'),
    ('brian-mast',            'Brian Mast',              'brian-mast',            'house', 'R', 'FL', 'FL21', 'Mast',      'Foreign Affairs'),
    ('thomas-massie',         'Thomas Massie',           'thomas-massie',         'house', 'R', 'KY', 'KY04', 'Massie',    'Transportation; Judiciary')
on conflict (id) do nothing;

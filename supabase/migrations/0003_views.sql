-- Derived views used by the app.

-- Flattened insider transaction feed: one row per non-derivative transaction,
-- joined with filing + company context. The UI filters on code (P = buys).
create or replace view insider_trades as
select
    t.id,
    t.accession_no,
    t.transaction_date,
    t.transaction_code,
    t.acquired_disposed,
    t.shares,
    t.price_per_share,
    t.total_value,
    t.shares_owned_after,
    t.security_title,
    f.filed_at,
    f.insider_cik,
    f.insider_name,
    f.insider_title,
    f.is_director,
    f.is_officer,
    f.is_ten_percent_owner,
    f.source_url,
    c.cik    as company_cik,
    c.ticker as ticker,
    c.name   as company_name,
    -- % increase in holdings implied by this transaction
    case
        when t.shares_owned_after is not null
             and t.shares_owned_after - t.shares > 0
        then round(t.shares / (t.shares_owned_after - t.shares) * 100, 1)
    end as pct_holdings_increase
from transactions t
join filings_form4 f on f.accession_no = t.accession_no
join companies c on c.cik = f.company_cik
where t.is_derivative = false;

-- Cluster buys: 2+ distinct insiders making open-market buys (code P) of the
-- same company within a rolling 14-day window ending today.
create or replace view cluster_buys as
select
    c.cik    as company_cik,
    c.ticker as ticker,
    c.name   as company_name,
    count(distinct f.insider_cik) as insider_count,
    sum(t.total_value)            as total_value,
    sum(t.shares)                 as total_shares,
    min(t.transaction_date)       as first_buy,
    max(t.transaction_date)       as last_buy
from transactions t
join filings_form4 f on f.accession_no = t.accession_no
join companies c on c.cik = f.company_cik
where t.is_derivative = false
  and t.transaction_code = 'P'
  and t.transaction_date >= current_date - interval '14 days'
group by c.cik, c.ticker, c.name
having count(distinct f.insider_cik) >= 2;

-- Quarter-over-quarter 13F changes per institution/CUSIP. For each holding in
-- a period, compare with the same institution's previous filed period.
create or replace view holdings_13f_changes as
with periods as (
    select
        institution_cik,
        period_of_report,
        lag(period_of_report) over (
            partition by institution_cik order by period_of_report
        ) as prev_period
    from filings_13f
),
agg as (
    -- collapse multiple lines of the same CUSIP (e.g. shared/sole voting rows)
    select
        institution_cik,
        period_of_report,
        cusip,
        max(ticker)      as ticker,
        max(issuer_name) as issuer_name,
        sum(value)       as value,
        sum(shares)      as shares
    from holdings_13f
    group by institution_cik, period_of_report, cusip
)
select
    cur.institution_cik,
    cur.period_of_report,
    cur.cusip,
    cur.ticker,
    cur.issuer_name,
    cur.value,
    cur.shares,
    prev.shares as prev_shares,
    prev.value  as prev_value,
    case
        when prev.shares is null            then 'new'
        when cur.shares > prev.shares       then 'added'
        when cur.shares < prev.shares       then 'trimmed'
        else 'unchanged'
    end as change,
    case
        when prev.shares is not null and prev.shares > 0
        then round((cur.shares - prev.shares) / prev.shares * 100, 1)
    end as pct_change_shares
from agg cur
join periods p
  on p.institution_cik = cur.institution_cik
 and p.period_of_report = cur.period_of_report
left join agg prev
  on prev.institution_cik = cur.institution_cik
 and prev.period_of_report = p.prev_period
 and prev.cusip = cur.cusip;

-- Positions that were closed entirely vs. the previous quarter.
create or replace view holdings_13f_exits as
with periods as (
    select
        institution_cik,
        period_of_report,
        lead(period_of_report) over (
            partition by institution_cik order by period_of_report
        ) as next_period
    from filings_13f
),
agg as (
    select
        institution_cik, period_of_report, cusip,
        max(ticker) as ticker, max(issuer_name) as issuer_name,
        sum(value) as value, sum(shares) as shares
    from holdings_13f
    group by institution_cik, period_of_report, cusip
)
select
    prev.institution_cik,
    p.next_period as period_of_report,   -- the quarter in which it disappeared
    prev.cusip,
    prev.ticker,
    prev.issuer_name,
    prev.shares as prev_shares,
    prev.value  as prev_value
from agg prev
join periods p
  on p.institution_cik = prev.institution_cik
 and p.period_of_report = prev.period_of_report
where p.next_period is not null
  and not exists (
      select 1 from agg cur
      where cur.institution_cik = prev.institution_cik
        and cur.period_of_report = p.next_period
        and cur.cusip = prev.cusip
  );

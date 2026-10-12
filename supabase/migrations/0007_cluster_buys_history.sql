-- Cluster buys, kept indefinitely: 2+ distinct insiders making open-market buys
-- (code P) of the same company, where consecutive buys are at most 14 days
-- apart. Each burst of buying becomes its own row; is_active marks clusters
-- whose latest buy is within the last 14 days.
create or replace view cluster_buys as
with buys as (
    select c.cik, c.ticker, c.name, f.insider_cik,
           t.transaction_date, t.total_value, t.shares
    from transactions t
    join filings_form4 f on f.accession_no = t.accession_no
    join companies c on c.cik = f.company_cik
    where t.is_derivative = false
      and t.transaction_code = 'P'
      and t.transaction_date is not null
),
marked as (
    select *,
        case when transaction_date - lag(transaction_date)
                  over (partition by cik order by transaction_date) <= 14
             then 0 else 1 end as starts_island
    from buys
),
islands as (
    select *, sum(starts_island) over (
        partition by cik order by transaction_date
        rows unbounded preceding) as island
    from marked
)
select
    cik  as company_cik,
    ticker,
    name as company_name,
    count(distinct insider_cik) as insider_count,
    sum(total_value)            as total_value,
    sum(shares)                 as total_shares,
    min(transaction_date)       as first_buy,
    max(transaction_date)       as last_buy,
    max(transaction_date) >= current_date - interval '14 days' as is_active
from islands
group by cik, ticker, name, island
having count(distinct insider_cik) >= 2;

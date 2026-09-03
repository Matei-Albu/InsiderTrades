// Package store is the Postgres (Supabase) persistence layer for the ingester.
package store

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/mateialbu/insidertrades/ingester/internal/edgar"
)

type Store struct {
	pool *pgxpool.Pool
}

func New(ctx context.Context, databaseURL string) (*Store, error) {
	if databaseURL == "" {
		return nil, fmt.Errorf("DATABASE_URL env var is required")
	}
	pool, err := pgxpool.New(ctx, databaseURL)
	if err != nil {
		return nil, fmt.Errorf("connect to postgres: %w", err)
	}
	if err := pool.Ping(ctx); err != nil {
		return nil, fmt.Errorf("ping postgres: %w", err)
	}
	return &Store{pool: pool}, nil
}

func (s *Store) Close() { s.pool.Close() }

// ---------------------------------------------------------------------------
// Form 4
// ---------------------------------------------------------------------------

// HasForm4 reports whether a filing is already ingested.
func (s *Store) HasForm4(ctx context.Context, accessionNo string) (bool, error) {
	var exists bool
	err := s.pool.QueryRow(ctx,
		`select exists (select 1 from filings_form4 where accession_no = $1)`,
		accessionNo).Scan(&exists)
	return exists, err
}

// SaveForm4 upserts the company + insider and inserts the filing with its
// transactions in one database transaction.
func (s *Store) SaveForm4(ctx context.Context, accessionNo string, filedAt time.Time, sourceURL string, f *edgar.Form4) error {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	_, err = tx.Exec(ctx, `
		insert into companies (cik, ticker, name, updated_at)
		values ($1, nullif($2, ''), $3, now())
		on conflict (cik) do update
		set ticker = coalesce(nullif(excluded.ticker, ''), companies.ticker),
		    name = excluded.name, updated_at = now()`,
		f.IssuerCIK, f.IssuerTicker, f.IssuerName)
	if err != nil {
		return fmt.Errorf("upsert company: %w", err)
	}

	_, err = tx.Exec(ctx, `
		insert into insiders (cik, name) values ($1, $2)
		on conflict (cik) do update set name = excluded.name`,
		f.OwnerCIK, f.OwnerName)
	if err != nil {
		return fmt.Errorf("upsert insider: %w", err)
	}

	var period *string
	if f.PeriodOfReport != "" {
		period = &f.PeriodOfReport
	}
	_, err = tx.Exec(ctx, `
		insert into filings_form4
		    (accession_no, company_cik, insider_cik, insider_name, insider_title,
		     is_director, is_officer, is_ten_percent_owner, filed_at,
		     period_of_report, source_url)
		values ($1, $2, $3, $4, nullif($5, ''), $6, $7, $8, $9, $10, $11)
		on conflict (accession_no) do nothing`,
		accessionNo, f.IssuerCIK, f.OwnerCIK, f.OwnerName, f.OfficerTitle,
		f.IsDirector, f.IsOfficer, f.IsTenPercentOwner, filedAt, period, sourceURL)
	if err != nil {
		return fmt.Errorf("insert filing: %w", err)
	}

	for _, t := range f.Transactions {
		var date *string
		if t.Date != "" {
			date = &t.Date
		}
		totalValue := t.Shares * t.PricePerShare
		_, err = tx.Exec(ctx, `
			insert into transactions
			    (accession_no, transaction_date, transaction_code,
			     acquired_disposed, shares, price_per_share, total_value,
			     shares_owned_after, security_title, is_derivative)
			values ($1, $2, nullif($3, ''), nullif($4, ''), $5, $6, $7, $8, nullif($9, ''), $10)`,
			accessionNo, date, t.Code, t.AcquiredDisposed, t.Shares,
			t.PricePerShare, totalValue, t.SharesOwnedAfter, t.SecurityTitle,
			t.IsDerivative)
		if err != nil {
			return fmt.Errorf("insert transaction: %w", err)
		}
	}
	return tx.Commit(ctx)
}

// ---------------------------------------------------------------------------
// 13F
// ---------------------------------------------------------------------------

type Institution struct {
	CIK  string
	Name string
	Slug string
}

func (s *Store) Institutions(ctx context.Context) ([]Institution, error) {
	rows, err := s.pool.Query(ctx, `select cik, name, slug from institutions order by name`)
	if err != nil {
		return nil, err
	}
	return pgx.CollectRows(rows, pgx.RowToStructByPos[Institution])
}

func (s *Store) Has13F(ctx context.Context, accessionNo string) (bool, error) {
	var exists bool
	err := s.pool.QueryRow(ctx,
		`select exists (select 1 from filings_13f where accession_no = $1)`,
		accessionNo).Scan(&exists)
	return exists, err
}

// Save13F inserts a 13F filing and its holdings in one transaction.
func (s *Store) Save13F(ctx context.Context, institutionCIK string, f edgar.ThirteenFFiling, holdings []edgar.Holding, tickers *edgar.TickerMap) error {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	var total float64
	for _, h := range holdings {
		total += h.Value
	}
	_, err = tx.Exec(ctx, `
		insert into filings_13f (accession_no, institution_cik, period_of_report, filed_at, total_value)
		values ($1, $2, $3, $4, $5)
		on conflict (accession_no) do nothing`,
		f.AccessionNo, institutionCIK, f.PeriodOfReport, f.FiledAt, total)
	if err != nil {
		return fmt.Errorf("insert 13f filing: %w", err)
	}

	batch := &pgx.Batch{}
	for _, h := range holdings {
		ticker := ""
		if tickers != nil {
			ticker = tickers.ByName(h.IssuerName)
		}
		batch.Queue(`
			insert into holdings_13f
			    (accession_no, institution_cik, period_of_report, cusip, ticker,
			     issuer_name, class_title, value, shares, share_type)
			values ($1, $2, $3, $4, nullif($5, ''), $6, nullif($7, ''), $8, $9, nullif($10, ''))`,
			f.AccessionNo, institutionCIK, f.PeriodOfReport, h.CUSIP, ticker,
			h.IssuerName, h.ClassTitle, h.Value, h.Shares, h.ShareType)
	}
	if err := tx.SendBatch(ctx, batch).Close(); err != nil {
		return fmt.Errorf("insert holdings: %w", err)
	}
	return tx.Commit(ctx)
}

// ---------------------------------------------------------------------------
// Prices
// ---------------------------------------------------------------------------

// ActiveTickers returns tickers worth pricing: companies with insider filings
// in the last year plus everything on any user's watchlist.
func (s *Store) ActiveTickers(ctx context.Context) ([]string, error) {
	rows, err := s.pool.Query(ctx, `
		select distinct c.ticker
		from companies c
		join filings_form4 f on f.company_cik = c.cik
		where c.ticker is not null and f.filed_at > now() - interval '1 year'
		union
		select distinct ticker from watchlists`)
	if err != nil {
		return nil, err
	}
	return pgx.CollectRows(rows, pgx.RowTo[string])
}

// LatestPriceDate returns the most recent stored price date for a ticker.
func (s *Store) LatestPriceDate(ctx context.Context, ticker string) (time.Time, bool, error) {
	var d *time.Time
	err := s.pool.QueryRow(ctx,
		`select max(date) from prices where ticker = $1`, ticker).Scan(&d)
	if err != nil || d == nil {
		return time.Time{}, false, err
	}
	return *d, true, nil
}

type PriceRow struct {
	Date   string // YYYY-MM-DD
	Open   float64
	High   float64
	Low    float64
	Close  float64
	Volume int64
}

func (s *Store) UpsertPrices(ctx context.Context, ticker string, rows []PriceRow) error {
	batch := &pgx.Batch{}
	for _, r := range rows {
		batch.Queue(`
			insert into prices (ticker, date, open, high, low, close, volume)
			values ($1, $2, $3, $4, $5, $6, $7)
			on conflict (ticker, date) do update
			set open = excluded.open, high = excluded.high, low = excluded.low,
			    close = excluded.close, volume = excluded.volume`,
			ticker, r.Date, r.Open, r.High, r.Low, r.Close, r.Volume)
	}
	return s.pool.SendBatch(ctx, batch).Close()
}

// ---------------------------------------------------------------------------
// Ingest state + alerts
// ---------------------------------------------------------------------------

func (s *Store) GetState(ctx context.Context, key string) (string, error) {
	var v string
	err := s.pool.QueryRow(ctx,
		`select value from ingest_state where key = $1`, key).Scan(&v)
	if err == pgx.ErrNoRows {
		return "", nil
	}
	return v, err
}

func (s *Store) SetState(ctx context.Context, key, value string) error {
	_, err := s.pool.Exec(ctx, `
		insert into ingest_state (key, value, updated_at)
		values ($1, $2, now())
		on conflict (key) do update set value = excluded.value, updated_at = now()`,
		key, value)
	return err
}

// PendingAlert is a watchlist hit that has not been emailed yet.
type PendingAlert struct {
	UserID      string
	Email       string
	Ticker      string
	AccessionNo string
	InsiderName string
	CompanyName string
	Code        string
	Shares      float64
	TotalValue  float64
	FiledAt     time.Time
}

// PendingAlerts finds new non-derivative transactions on watchlisted tickers
// that have not yet been alerted to the watching user.
func (s *Store) PendingAlerts(ctx context.Context, since time.Time) ([]PendingAlert, error) {
	rows, err := s.pool.Query(ctx, `
		select w.user_id::text, u.email, w.ticker, f.accession_no,
		       f.insider_name, c.name,
		       coalesce(t.transaction_code, ''),
		       coalesce(sum(t.shares), 0), coalesce(sum(t.total_value), 0),
		       f.filed_at
		from watchlists w
		join auth.users u on u.id = w.user_id
		join companies c on c.ticker = w.ticker
		join filings_form4 f on f.company_cik = c.cik
		join transactions t on t.accession_no = f.accession_no
		where f.created_at > $1
		  and t.is_derivative = false
		  and t.transaction_code in ('P', 'S')
		  and u.email is not null
		  and not exists (
		      select 1 from alert_log a
		      where a.user_id = w.user_id and a.accession_no = f.accession_no)
		group by w.user_id, u.email, w.ticker, f.accession_no, f.insider_name,
		         c.name, t.transaction_code, f.filed_at`,
		since)
	if err != nil {
		return nil, err
	}
	return pgx.CollectRows(rows, pgx.RowToStructByPos[PendingAlert])
}

func (s *Store) LogAlert(ctx context.Context, userID, accessionNo, ticker string) error {
	_, err := s.pool.Exec(ctx, `
		insert into alert_log (user_id, accession_no, ticker)
		values ($1, $2, $3)
		on conflict (user_id, accession_no) do nothing`,
		userID, accessionNo, ticker)
	return err
}

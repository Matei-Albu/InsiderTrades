// Command ingester runs InsiderTrades data jobs. Subcommands:
//
//	form4        poll EDGAR's current Form 4 feed and ingest new filings
//	backfill13f  fetch 13F holdings for all curated institutions
//	prices       fetch EOD prices from Yahoo Finance for active tickers
//	alerts       email watchlist alerts for newly ingested filings
//	congress     fetch House STOCK Act PTRs for curated politicians
package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"time"

	"github.com/mateialbu/insidertrades/ingester/internal/alerts"
	"github.com/mateialbu/insidertrades/ingester/internal/congress"
	"github.com/mateialbu/insidertrades/ingester/internal/edgar"
	"github.com/mateialbu/insidertrades/ingester/internal/prices"
	"github.com/mateialbu/insidertrades/ingester/internal/store"
)

func main() {
	if len(os.Args) < 2 {
		fmt.Fprintln(os.Stderr, "usage: ingester <form4|backfill13f|prices|alerts|congress>")
		os.Exit(2)
	}
	ctx := context.Background()

	db, err := store.New(ctx, os.Getenv("DATABASE_URL"))
	if err != nil {
		log.Fatalf("store: %v", err)
	}
	defer db.Close()

	switch os.Args[1] {
	case "form4":
		err = runForm4(ctx, db)
	case "backfill13f":
		err = run13F(ctx, db)
	case "prices":
		err = runPrices(ctx, db)
	case "alerts":
		err = runAlerts(ctx, db)
	case "congress":
		err = runCongress(ctx, db)
	default:
		log.Fatalf("unknown subcommand %q", os.Args[1])
	}
	if err != nil {
		log.Fatalf("%s: %v", os.Args[1], err)
	}
}

// runForm4 ingests new filings from the current Form 4 Atom feed.
func runForm4(ctx context.Context, db *store.Store) error {
	client, err := edgar.NewClient()
	if err != nil {
		return err
	}
	entries, err := client.LatestForm4Filings()
	if err != nil {
		return err
	}
	log.Printf("feed returned %d form 4 filings", len(entries))

	var ingested, skipped, failed int
	for _, e := range entries {
		exists, err := db.HasForm4(ctx, e.AccessionNo)
		if err != nil {
			return err
		}
		if exists {
			skipped++
			continue
		}
		f, err := client.FetchForm4(e.CIK, e.AccessionNo)
		if err != nil {
			// Individual filings can be malformed; log and move on.
			log.Printf("WARN %s: %v", e.AccessionNo, err)
			failed++
			continue
		}
		filedAt := e.Updated
		if filedAt.IsZero() {
			filedAt = time.Now()
		}
		if err := db.SaveForm4(ctx, e.AccessionNo, filedAt, e.IndexURL, f); err != nil {
			return fmt.Errorf("save %s: %w", e.AccessionNo, err)
		}
		ingested++
	}
	log.Printf("form4 done: %d ingested, %d already present, %d failed", ingested, skipped, failed)
	return nil
}

// run13F fetches recent 13F-HR filings for every curated institution.
func run13F(ctx context.Context, db *store.Store) error {
	client, err := edgar.NewClient()
	if err != nil {
		return err
	}
	institutions, err := db.Institutions(ctx)
	if err != nil {
		return err
	}
	tickers, err := client.FetchTickerMap()
	if err != nil {
		log.Printf("WARN ticker map unavailable, holdings will lack tickers: %v", err)
	}

	const quartersToKeep = 8 // ~2 years of history for QoQ diffs
	for _, inst := range institutions {
		name, filings, err := client.ThirteenFFilings(inst.CIK)
		if err != nil {
			log.Printf("WARN %s: %v", inst.Slug, err)
			continue
		}
		if len(filings) > quartersToKeep {
			filings = filings[:quartersToKeep]
		}
		log.Printf("%s (%s): %d 13F-HR filings", inst.Name, name, len(filings))
		for _, f := range filings {
			exists, err := db.Has13F(ctx, f.AccessionNo)
			if err != nil {
				return err
			}
			if exists {
				continue
			}
			holdings, err := client.FetchHoldings(inst.CIK, f)
			if err != nil {
				log.Printf("WARN %s %s: %v", inst.Slug, f.AccessionNo, err)
				continue
			}
			if err := db.Save13F(ctx, inst.CIK, f, holdings, tickers); err != nil {
				return fmt.Errorf("save 13f %s: %w", f.AccessionNo, err)
			}
			log.Printf("  ingested %s (%s): %d holdings", f.AccessionNo, f.PeriodOfReport, len(holdings))
		}
	}
	return nil
}

// runPrices refreshes EOD prices for all active tickers.
func runPrices(ctx context.Context, db *store.Store) error {
	tickers, err := db.ActiveTickers(ctx)
	if err != nil {
		return err
	}
	log.Printf("refreshing prices for %d tickers", len(tickers))

	var updated, empty int
	for _, ticker := range tickers {
		since := time.Now().AddDate(-1, 0, 0) // first fetch: 1 year of history
		if last, ok, err := db.LatestPriceDate(ctx, ticker); err != nil {
			return err
		} else if ok {
			since = last.AddDate(0, 0, 1)
		}
		if since.After(time.Now()) {
			continue
		}
		rows, err := prices.FetchDaily(ticker, since)
		if err != nil {
			log.Printf("WARN %s: %v", ticker, err)
			continue
		}
		if len(rows) == 0 {
			empty++
			continue
		}
		if err := db.UpsertPrices(ctx, ticker, rows); err != nil {
			return fmt.Errorf("upsert %s: %w", ticker, err)
		}
		updated++
		time.Sleep(300 * time.Millisecond) // be polite to Yahoo
	}
	log.Printf("prices done: %d tickers updated, %d without data", updated, empty)
	return nil
}

// runAlerts emails users about new filings matching their watchlists.
func runAlerts(ctx context.Context, db *store.Store) error {
	sender, err := alerts.NewSender()
	if err != nil {
		return err
	}

	// Look back from the last successful run (default 24h on first run).
	since := time.Now().Add(-24 * time.Hour)
	if v, err := db.GetState(ctx, "alerts_last_run"); err != nil {
		return err
	} else if v != "" {
		if t, err := time.Parse(time.RFC3339, v); err == nil {
			since = t
		}
	}
	runStart := time.Now()

	pending, err := db.PendingAlerts(ctx, since)
	if err != nil {
		return err
	}
	log.Printf("%d pending alert rows since %s", len(pending), since.Format(time.RFC3339))

	// Group per user so each gets one digest email.
	type userKey struct{ id, email string }
	byUser := map[userKey][]store.PendingAlert{}
	for _, p := range pending {
		k := userKey{p.UserID, p.Email}
		byUser[k] = append(byUser[k], p)
	}

	var sent int
	for user, items := range byUser {
		if err := sender.SendDigest(user.email, items); err != nil {
			log.Printf("WARN email %s: %v", user.email, err)
			continue
		}
		for _, it := range items {
			if err := db.LogAlert(ctx, it.UserID, it.AccessionNo, it.Ticker); err != nil {
				return err
			}
		}
		sent++
	}
	log.Printf("alerts done: %d digests sent", sent)
	return db.SetState(ctx, "alerts_last_run", runStart.Format(time.RFC3339))
}

// runCongress ingests House STOCK Act PTRs for curated politicians.
func runCongress(ctx context.Context, db *store.Store) error {
	politicians, err := db.Politicians(ctx)
	if err != nil {
		return err
	}
	if len(politicians) == 0 {
		log.Printf("no active house politicians seeded")
		return nil
	}

	client := congress.NewClient()
	now := time.Now().UTC()
	years := []int{now.Year()}
	if now.Month() <= 2 {
		years = append(years, now.Year()-1)
	} else {
		// Always also scan prior year for late filings.
		years = append(years, now.Year()-1)
	}

	tmpDir, err := os.MkdirTemp("", "congress-ptr-*")
	if err != nil {
		return err
	}
	defer os.RemoveAll(tmpDir)

	var ingested, skipped, empty, failed int
	for _, year := range years {
		filings, err := client.FetchPTRIndex(year)
		if err != nil {
			log.Printf("WARN index %d: %v", year, err)
			continue
		}
		log.Printf("year %d: %d PTR filings in index", year, len(filings))

		for _, pol := range politicians {
			for _, f := range filings {
				if !congress.Matches(f, pol.LastName, pol.District) {
					continue
				}
				exists, err := db.HasCongressFiling(ctx, f.DocID)
				if err != nil {
					return err
				}
				if exists {
					skipped++
					continue
				}

				pdfPath := filepath.Join(tmpDir, f.DocID+".pdf")
				if err := client.DownloadPDF(f.SourceURL, pdfPath); err != nil {
					log.Printf("WARN download %s %s: %v", pol.Slug, f.DocID, err)
					failed++
					continue
				}
				trades, err := congress.ParsePDF(pdfPath)
				if err != nil {
					log.Printf("WARN parse %s %s: %v", pol.Slug, f.DocID, err)
					failed++
					continue
				}
				if len(trades) == 0 {
					// Scanned/image PDFs often yield zero rows — still record the filing.
					empty++
				}
				if err := db.SaveCongressFiling(ctx, pol.ID, f, trades); err != nil {
					return fmt.Errorf("save %s: %w", f.DocID, err)
				}
				ingested++
				log.Printf("  %s %s (%s): %d trades", pol.Name, f.DocID, f.FiledAt.Format("2006-01-02"), len(trades))
			}
		}
	}
	log.Printf("congress done: %d filings ingested, %d skipped, %d empty parses, %d failed",
		ingested, skipped, empty, failed)
	return nil
}

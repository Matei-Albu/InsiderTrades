// Command verify is a smoke test against live EDGAR endpoints (no database).
package main

import (
	"fmt"
	"log"
	"time"

	"github.com/mateialbu/insidertrades/ingester/internal/edgar"
	"github.com/mateialbu/insidertrades/ingester/internal/prices"
)

func main() {
	client, err := edgar.NewClient()
	if err != nil {
		log.Fatal(err)
	}

	// 1. Current Form 4 feed
	entries, err := client.LatestForm4Filings()
	if err != nil {
		log.Fatalf("feed: %v", err)
	}
	fmt.Printf("feed: %d filings\n", len(entries))
	if len(entries) == 0 {
		log.Fatal("no entries in feed")
	}

	// 2. Parse the first few real Form 4s
	for i, e := range entries {
		if i >= 3 {
			break
		}
		f, err := client.FetchForm4(e.CIK, e.AccessionNo)
		if err != nil {
			log.Fatalf("form4 %s: %v", e.AccessionNo, err)
		}
		fmt.Printf("form4 %s: issuer=%s (%s) owner=%s txns=%d\n",
			e.AccessionNo, f.IssuerName, f.IssuerTicker, f.OwnerName, len(f.Transactions))
	}

	// 3. Berkshire's latest 13F
	name, filings, err := client.ThirteenFFilings("0001067983")
	if err != nil {
		log.Fatalf("13f list: %v", err)
	}
	fmt.Printf("13f: %s has %d 13F-HR filings\n", name, len(filings))
	holdings, err := client.FetchHoldings("0001067983", filings[0])
	if err != nil {
		log.Fatalf("13f holdings: %v", err)
	}
	var total float64
	for _, h := range holdings {
		total += h.Value
	}
	fmt.Printf("13f %s (%s): %d holdings, total $%.0fM\n",
		filings[0].AccessionNo, filings[0].PeriodOfReport, len(holdings), total/1e6)
	fmt.Printf("  sample: %+v\n", holdings[0])

	// 4. Ticker map
	tm, err := client.FetchTickerMap()
	if err != nil {
		log.Fatalf("ticker map: %v", err)
	}
	fmt.Printf("ticker map: AAPL by name = %q\n", tm.ByName("APPLE INC"))

	// 5. Yahoo EOD prices
	rows, err := prices.FetchDaily("AAPL", time.Now().AddDate(0, 0, -10))
	if err != nil {
		log.Fatalf("prices: %v", err)
	}
	fmt.Printf("prices: %d rows for AAPL, latest %s close $%.2f\n",
		len(rows), rows[len(rows)-1].Date, rows[len(rows)-1].Close)
}

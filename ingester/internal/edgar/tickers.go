package edgar

import (
	"encoding/json"
	"fmt"
	"regexp"
	"sort"
	"strconv"
	"strings"
)

const companyTickersURL = "https://www.sec.gov/files/company_tickers.json"

// TickerMap maps CIKs and normalized company names to exchange tickers.
// Built from the SEC's company_tickers.json (exchange-listed issuers only).
type TickerMap struct {
	byCIK  map[string]string
	byName map[string]string
}

type tickerEntry struct {
	CIK    json.Number `json:"cik_str"`
	Ticker string      `json:"ticker"`
	Title  string      `json:"title"`
}

// FetchTickerMap downloads and indexes the SEC ticker file.
func (c *Client) FetchTickerMap() (*TickerMap, error) {
	body, err := c.Get(companyTickersURL)
	if err != nil {
		return nil, err
	}
	return parseTickerMap(body)
}

func parseTickerMap(body []byte) (*TickerMap, error) {
	var entries map[string]tickerEntry
	if err := json.Unmarshal(body, &entries); err != nil {
		return nil, fmt.Errorf("parse company_tickers.json: %w", err)
	}
	// The file is keyed by numeric index; lower index = primary listing.
	// Iterate in index order so companies with several share classes resolve
	// to their primary ticker (e.g. Alphabet -> GOOGL, not a secondary line).
	keys := make([]int, 0, len(entries))
	for k := range entries {
		if i, err := strconv.Atoi(k); err == nil {
			keys = append(keys, i)
		}
	}
	sort.Ints(keys)

	tm := &TickerMap{byCIK: map[string]string{}, byName: map[string]string{}}
	for _, k := range keys {
		e := entries[strconv.Itoa(k)]
		cik := PadCIK(e.CIK.String())
		if _, ok := tm.byCIK[cik]; !ok {
			tm.byCIK[cik] = e.Ticker
		}
		name := normalizeCompanyName(e.Title)
		if _, ok := tm.byName[name]; !ok && name != "" {
			tm.byName[name] = e.Ticker
		}
	}
	return tm, nil
}

// ByCIK returns the primary ticker for a CIK, or "".
func (tm *TickerMap) ByCIK(cik string) string {
	return tm.byCIK[PadCIK(cik)]
}

// ByName best-effort resolves a 13F issuer name to a ticker, or "".
func (tm *TickerMap) ByName(issuerName string) string {
	return tm.byName[normalizeCompanyName(issuerName)]
}

var nonAlnum = regexp.MustCompile(`[^a-z0-9 ]+`)

// normalizeCompanyName lowercases and strips punctuation and common corporate
// suffixes so "APPLE INC" matches "Apple Inc.".
func normalizeCompanyName(s string) string {
	s = strings.ToLower(strings.TrimSpace(s))
	s = nonAlnum.ReplaceAllString(s, " ")
	words := strings.Fields(s)
	for len(words) > 1 {
		switch words[len(words)-1] {
		case "inc", "corp", "corporation", "co", "company", "ltd", "plc", "llc",
			"lp", "sa", "nv", "se", "ag", "holdings", "holding", "group", "the",
			"cl", "class", "a", "b", "c", "com", "new", "del":
			words = words[:len(words)-1]
		default:
			return strings.Join(words, " ")
		}
	}
	return strings.Join(words, " ")
}

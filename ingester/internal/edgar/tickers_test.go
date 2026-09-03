package edgar

import "testing"

func TestParseTickerMapPrefersPrimaryListing(t *testing.T) {
	// Deliberately list the secondary class at a lower JSON-object position but
	// higher index: index order must win, not map iteration order.
	body := `{
        "1": {"cik_str": 1652044, "ticker": "GOOG", "title": "Alphabet Inc."},
        "0": {"cik_str": 1652044, "ticker": "GOOGL", "title": "Alphabet Inc."},
        "2": {"cik_str": 320193, "ticker": "AAPL", "title": "Apple Inc."}
    }`
	tm, err := parseTickerMap([]byte(body))
	if err != nil {
		t.Fatalf("parseTickerMap: %v", err)
	}
	if got := tm.ByCIK("1652044"); got != "GOOGL" {
		t.Errorf("ByCIK = %q, want GOOGL (primary listing)", got)
	}
	if got := tm.ByName("ALPHABET INC"); got != "GOOGL" {
		t.Errorf("ByName = %q, want GOOGL", got)
	}
	if got := tm.ByCIK("0000320193"); got != "AAPL" {
		t.Errorf("ByCIK(AAPL) = %q", got)
	}
}

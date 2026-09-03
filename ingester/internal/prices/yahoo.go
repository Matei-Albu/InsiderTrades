// Package prices fetches free end-of-day OHLC data from Yahoo Finance's
// public chart endpoint (no API key; requires a browser-like User-Agent).
package prices

import (
	"encoding/json"
	"fmt"
	"io"
	"math"
	"net/http"
	"net/url"
	"time"

	"github.com/mateialbu/insidertrades/ingester/internal/store"
)

var httpClient = &http.Client{Timeout: 30 * time.Second}

const userAgent = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"

type chartResponse struct {
	Chart struct {
		Result []struct {
			Timestamp  []int64 `json:"timestamp"`
			Indicators struct {
				Quote []struct {
					Open   []*float64 `json:"open"`
					High   []*float64 `json:"high"`
					Low    []*float64 `json:"low"`
					Close  []*float64 `json:"close"`
					Volume []*int64   `json:"volume"`
				} `json:"quote"`
			} `json:"indicators"`
		} `json:"result"`
		Error *struct {
			Code        string `json:"code"`
			Description string `json:"description"`
		} `json:"error"`
	} `json:"chart"`
}

// FetchDaily returns EOD rows for a ticker since the given date (inclusive).
func FetchDaily(ticker string, since time.Time) ([]store.PriceRow, error) {
	u := fmt.Sprintf(
		"https://query1.finance.yahoo.com/v8/finance/chart/%s?period1=%d&period2=%d&interval=1d&events=history",
		url.PathEscape(ticker), since.Unix(), time.Now().Unix())

	req, err := http.NewRequest(http.MethodGet, u, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", userAgent)

	resp, err := httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("yahoo %s: %w", ticker, err)
	}
	defer resp.Body.Close()
	if resp.StatusCode == http.StatusNotFound {
		return nil, nil // unknown/delisted symbol
	}
	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 256))
		return nil, fmt.Errorf("yahoo %s: status %d: %s", ticker, resp.StatusCode, string(body))
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	return parseChart(body)
}

func parseChart(body []byte) ([]store.PriceRow, error) {
	var cr chartResponse
	if err := json.Unmarshal(body, &cr); err != nil {
		return nil, fmt.Errorf("parse chart json: %w", err)
	}
	if cr.Chart.Error != nil {
		return nil, fmt.Errorf("yahoo error: %s", cr.Chart.Error.Description)
	}
	if len(cr.Chart.Result) == 0 || len(cr.Chart.Result[0].Indicators.Quote) == 0 {
		return nil, nil
	}
	res := cr.Chart.Result[0]
	q := res.Indicators.Quote[0]

	var rows []store.PriceRow
	for i, ts := range res.Timestamp {
		if i >= len(q.Close) || q.Close[i] == nil {
			continue // market holidays / null bars
		}
		row := store.PriceRow{
			Date:  time.Unix(ts, 0).UTC().Format("2006-01-02"),
			Close: round2(*q.Close[i]),
		}
		if i < len(q.Open) && q.Open[i] != nil {
			row.Open = round2(*q.Open[i])
		}
		if i < len(q.High) && q.High[i] != nil {
			row.High = round2(*q.High[i])
		}
		if i < len(q.Low) && q.Low[i] != nil {
			row.Low = round2(*q.Low[i])
		}
		if i < len(q.Volume) && q.Volume[i] != nil {
			row.Volume = *q.Volume[i]
		}
		rows = append(rows, row)
	}
	return rows, nil
}

func round2(v float64) float64 {
	return math.Round(v*100) / 100
}

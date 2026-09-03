// Package edgar fetches and parses SEC EDGAR data (Form 4, 13F).
package edgar

import (
	"fmt"
	"io"
	"net/http"
	"os"
	"time"
)

// Client is a rate-limited HTTP client for SEC endpoints. The SEC fair-access
// policy requires a descriptive User-Agent with contact info and caps clients
// at 10 requests/second; we throttle below that.
type Client struct {
	http      *http.Client
	userAgent string
	throttle  <-chan time.Time
}

func NewClient() (*Client, error) {
	ua := os.Getenv("SEC_USER_AGENT")
	if ua == "" {
		return nil, fmt.Errorf("SEC_USER_AGENT env var is required (e.g. \"InsiderTrades yourname you@example.com\")")
	}
	return &Client{
		http:      &http.Client{Timeout: 30 * time.Second},
		userAgent: ua,
		throttle:  time.Tick(150 * time.Millisecond), // ~6.6 req/s, under the 10/s cap
	}, nil
}

// Get fetches a URL with throttling and the required User-Agent header.
func (c *Client) Get(url string) ([]byte, error) {
	<-c.throttle
	req, err := http.NewRequest(http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", c.userAgent)

	resp, err := c.http.Do(req)
	if err != nil {
		return nil, fmt.Errorf("GET %s: %w", url, err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 512))
		return nil, fmt.Errorf("GET %s: status %d: %s", url, resp.StatusCode, string(body))
	}
	return io.ReadAll(resp.Body)
}

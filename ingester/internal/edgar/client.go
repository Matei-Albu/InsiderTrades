// Package edgar fetches and parses SEC EDGAR data (Form 4, 13F).
package edgar

import (
	"errors"
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	"os"
	"strings"
	"time"
)

const (
	httpTimeout = 90 * time.Second
	maxAttempts = 4
)

// Client is a rate-limited HTTP client for SEC endpoints. The SEC fair-access
// policy requires a descriptive User-Agent with contact info and caps clients
// at 10 requests/second; we throttle below that.
type Client struct {
	http      *http.Client
	userAgent string
	throttle  <-chan time.Time
	// retryWait is the base backoff between attempts (doubled each time).
	retryWait time.Duration
}

func NewClient() (*Client, error) {
	ua := os.Getenv("SEC_USER_AGENT")
	if ua == "" {
		return nil, fmt.Errorf("SEC_USER_AGENT env var is required (e.g. \"InsiderTrades yourname you@example.com\")")
	}
	return &Client{
		http:      &http.Client{Timeout: httpTimeout},
		userAgent: ua,
		throttle:  time.Tick(150 * time.Millisecond), // ~6.6 req/s, under the 10/s cap
		retryWait: 2 * time.Second,
	}, nil
}

// Get fetches a URL with throttling and the required User-Agent header.
// Transient timeouts / 429 / 5xx responses are retried with backoff.
func (c *Client) Get(url string) ([]byte, error) {
	var lastErr error
	for attempt := 1; attempt <= maxAttempts; attempt++ {
		body, err := c.getOnce(url)
		if err == nil {
			return body, nil
		}
		lastErr = err
		if attempt == maxAttempts || !isTransient(err) {
			break
		}
		wait := c.retryWait * time.Duration(1<<(attempt-1)) // 2s, 4s, 8s
		log.Printf("edgar: retry %d/%d after %v: %v", attempt, maxAttempts-1, wait, err)
		time.Sleep(wait)
	}
	return nil, lastErr
}

func (c *Client) getOnce(url string) ([]byte, error) {
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
		return nil, &httpStatusError{
			url:    url,
			status: resp.StatusCode,
			body:   string(body),
		}
	}
	return io.ReadAll(resp.Body)
}

type httpStatusError struct {
	url    string
	status int
	body   string
}

func (e *httpStatusError) Error() string {
	return fmt.Sprintf("GET %s: status %d: %s", e.url, e.status, e.body)
}

func isTransient(err error) bool {
	var statusErr *httpStatusError
	if errors.As(err, &statusErr) {
		return statusErr.status == http.StatusTooManyRequests || statusErr.status >= 500
	}
	var netErr net.Error
	if errors.As(err, &netErr) && netErr.Timeout() {
		return true
	}
	// http.Client wraps timeouts as "Client.Timeout exceeded while awaiting headers"
	msg := err.Error()
	return strings.Contains(msg, "Timeout exceeded") ||
		strings.Contains(msg, "deadline exceeded") ||
		strings.Contains(msg, "connection reset") ||
		strings.Contains(msg, "temporary failure")
}

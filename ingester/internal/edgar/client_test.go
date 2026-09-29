package edgar

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"
	"time"
)

func TestGetRetriesTransientStatus(t *testing.T) {
	var hits atomic.Int32
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		n := hits.Add(1)
		if n < 3 {
			w.WriteHeader(http.StatusBadGateway)
			fmt.Fprint(w, "upstream busy")
			return
		}
		w.WriteHeader(http.StatusOK)
		fmt.Fprint(w, "ok-body")
	}))
	t.Cleanup(srv.Close)

	t.Setenv("SEC_USER_AGENT", "InsiderTrades test@example.com")
	c, err := NewClient()
	if err != nil {
		t.Fatal(err)
	}
	c.http.Timeout = 5 * time.Second
	c.throttle = time.Tick(time.Millisecond)
	c.retryWait = time.Millisecond

	body, err := c.Get(srv.URL)
	if err != nil {
		t.Fatalf("Get: %v", err)
	}
	if string(body) != "ok-body" {
		t.Fatalf("body = %q", body)
	}
	if hits.Load() != 3 {
		t.Fatalf("hits = %d, want 3", hits.Load())
	}
}

func TestGetDoesNotRetryNotFound(t *testing.T) {
	var hits atomic.Int32
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		hits.Add(1)
		w.WriteHeader(http.StatusNotFound)
		fmt.Fprint(w, "missing")
	}))
	t.Cleanup(srv.Close)

	t.Setenv("SEC_USER_AGENT", "InsiderTrades test@example.com")

	c, err := NewClient()
	if err != nil {
		t.Fatal(err)
	}
	c.throttle = time.Tick(time.Millisecond)
	c.retryWait = time.Millisecond

	_, err = c.Get(srv.URL)
	if err == nil {
		t.Fatal("expected error")
	}
	if hits.Load() != 1 {
		t.Fatalf("hits = %d, want 1 (no retry on 404)", hits.Load())
	}
}

func TestIsTransient(t *testing.T) {
	if !isTransient(fmt.Errorf("GET x: context deadline exceeded (Client.Timeout exceeded while awaiting headers)")) {
		t.Fatal("expected timeout string to be transient")
	}
	if isTransient(fmt.Errorf("GET x: status 404: missing")) {
		t.Fatal("plain 404 string should not match status helper path; wrapped status should")
	}
	if !isTransient(&httpStatusError{status: 503}) {
		t.Fatal("503 should be transient")
	}
	if isTransient(&httpStatusError{status: 404}) {
		t.Fatal("404 should not be transient")
	}
}

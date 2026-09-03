// Package alerts sends watchlist notification emails via Resend.
package alerts

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"time"

	"github.com/mateialbu/insidertrades/ingester/internal/store"
)

type Sender struct {
	apiKey string
	from   string
	http   *http.Client
}

func NewSender() (*Sender, error) {
	key := os.Getenv("RESEND_API_KEY")
	if key == "" {
		return nil, fmt.Errorf("RESEND_API_KEY env var is required")
	}
	from := os.Getenv("ALERT_FROM_EMAIL")
	if from == "" {
		from = "InsiderTrades <onboarding@resend.dev>" // Resend sandbox sender
	}
	return &Sender{
		apiKey: key,
		from:   from,
		http:   &http.Client{Timeout: 30 * time.Second},
	}, nil
}

// SendDigest emails one user a digest of new insider trades on their watchlist.
func (s *Sender) SendDigest(email string, items []store.PendingAlert) error {
	if len(items) == 0 {
		return nil
	}
	subject := fmt.Sprintf("Insider activity: %s", items[0].Ticker)
	if len(items) > 1 {
		subject = fmt.Sprintf("Insider activity on %d watched stocks", len(items))
	}

	var b bytes.Buffer
	b.WriteString("<h2>New insider filings on your watchlist</h2><ul>")
	for _, it := range items {
		action := "traded"
		switch it.Code {
		case "P":
			action = "bought"
		case "S":
			action = "sold"
		}
		fmt.Fprintf(&b,
			"<li><strong>%s</strong> (%s): %s %s %.0f shares (~$%.0f) — filed %s</li>",
			it.Ticker, it.CompanyName, it.InsiderName, action, it.Shares,
			it.TotalValue, it.FiledAt.Format("Jan 2 2006"))
	}
	b.WriteString("</ul><p>— InsiderTrades</p>")

	payload, err := json.Marshal(map[string]any{
		"from":    s.from,
		"to":      []string{email},
		"subject": subject,
		"html":    b.String(),
	})
	if err != nil {
		return err
	}

	req, err := http.NewRequest(http.MethodPost, "https://api.resend.com/emails", bytes.NewReader(payload))
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+s.apiKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := s.http.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 512))
		return fmt.Errorf("resend: status %d: %s", resp.StatusCode, string(body))
	}
	return nil
}

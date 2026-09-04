// Package congress fetches House STOCK Act Periodic Transaction Reports.
package congress

import (
	"archive/zip"
	"bytes"
	"encoding/json"
	"encoding/xml"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"time"
)

const disclosuresBase = "https://disclosures-clerk.house.gov"

// Client downloads House Clerk disclosure indexes and PTR PDFs.
type Client struct {
	http     *http.Client
	ua       string
	throttle <-chan time.Time
}

func NewClient() *Client {
	ua := os.Getenv("SEC_USER_AGENT")
	if ua == "" {
		ua = "InsiderTrades congress-bot contact@example.com"
	}
	return &Client{
		http:     &http.Client{Timeout: 60 * time.Second},
		ua:       ua,
		throttle: time.Tick(500 * time.Millisecond),
	}
}

// Filing is one Periodic Transaction Report from the yearly FD index.
type Filing struct {
	Last       string
	First      string
	StateDst   string
	Year       int
	FiledAt    time.Time
	DocID      string
	SourceURL  string
}

// Trade is one parsed PTR transaction row.
type Trade struct {
	Ticker           *string  `json:"ticker"`
	AssetName        string   `json:"asset_name"`
	TransactionType  string   `json:"transaction_type"`
	TransactionDate  string   `json:"transaction_date"`
	NotificationDate string   `json:"notification_date"`
	AmountRange      string   `json:"amount_range"`
	AmountMin        *float64 `json:"amount_min"`
	AmountMax        *float64 `json:"amount_max"`
	Owner            string   `json:"owner"`
	AssetType        *string  `json:"asset_type"`
	Description      *string  `json:"description"`
}

type fdMember struct {
	Last       string `xml:"Last"`
	First      string `xml:"First"`
	FilingType string `xml:"FilingType"`
	StateDst   string `xml:"StateDst"`
	Year       string `xml:"Year"`
	FilingDate string `xml:"FilingDate"`
	DocID      string `xml:"DocID"`
}

type fdRoot struct {
	Members []fdMember `xml:"Member"`
}

func (c *Client) get(url string) ([]byte, error) {
	<-c.throttle
	req, err := http.NewRequest(http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", c.ua)
	resp, err := c.http.Do(req)
	if err != nil {
		return nil, fmt.Errorf("GET %s: %w", url, err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 256))
		return nil, fmt.Errorf("GET %s: status %d: %s", url, resp.StatusCode, string(body))
	}
	return io.ReadAll(resp.Body)
}

// FetchPTRIndex downloads and parses {year}FD.zip for FilingType=P rows.
func (c *Client) FetchPTRIndex(year int) ([]Filing, error) {
	url := fmt.Sprintf("%s/public_disc/financial-pdfs/%dFD.zip", disclosuresBase, year)
	body, err := c.get(url)
	if err != nil {
		return nil, err
	}
	zr, err := zip.NewReader(bytes.NewReader(body), int64(len(body)))
	if err != nil {
		return nil, fmt.Errorf("open fd zip: %w", err)
	}
	var xmlBytes []byte
	for _, f := range zr.File {
		if strings.HasSuffix(strings.ToLower(f.Name), ".xml") {
			rc, err := f.Open()
			if err != nil {
				return nil, err
			}
			xmlBytes, err = io.ReadAll(rc)
			rc.Close()
			if err != nil {
				return nil, err
			}
			break
		}
	}
	if xmlBytes == nil {
		return nil, fmt.Errorf("no XML in %dFD.zip", year)
	}

	var root fdRoot
	if err := xml.Unmarshal(xmlBytes, &root); err != nil {
		return nil, fmt.Errorf("parse fd xml: %w", err)
	}

	out := make([]Filing, 0)
	for _, m := range root.Members {
		if strings.TrimSpace(m.FilingType) != "P" {
			continue
		}
		docID := strings.TrimSpace(m.DocID)
		if docID == "" {
			continue
		}
		y := year
		if strings.TrimSpace(m.Year) != "" {
			fmt.Sscanf(m.Year, "%d", &y)
		}
		filed, err := time.Parse("1/2/2006", strings.TrimSpace(m.FilingDate))
		if err != nil {
			filed, err = time.Parse("01/02/2006", strings.TrimSpace(m.FilingDate))
			if err != nil {
				continue
			}
		}
		out = append(out, Filing{
			Last:      strings.TrimSpace(m.Last),
			First:     strings.TrimSpace(m.First),
			StateDst:  strings.TrimSpace(m.StateDst),
			Year:      y,
			FiledAt:   filed,
			DocID:     docID,
			SourceURL: fmt.Sprintf("%s/public_disc/ptr-pdfs/%d/%s.pdf", disclosuresBase, y, docID),
		})
	}
	return out, nil
}

// DownloadPDF fetches a PTR PDF into destPath.
func (c *Client) DownloadPDF(sourceURL, destPath string) error {
	body, err := c.get(sourceURL)
	if err != nil {
		return err
	}
	return os.WriteFile(destPath, body, 0o644)
}

// ParsePDF runs scripts/parse_house_ptr.py against a local PDF.
func ParsePDF(pdfPath string) ([]Trade, error) {
	script, err := parserScriptPath()
	if err != nil {
		return nil, err
	}
	cmd := exec.Command("python3", script, pdfPath)
	out, err := cmd.Output()
	if err != nil {
		if ee, ok := err.(*exec.ExitError); ok {
			return nil, fmt.Errorf("parse pdf: %w: %s", err, string(ee.Stderr))
		}
		return nil, fmt.Errorf("parse pdf: %w", err)
	}
	var trades []Trade
	if err := json.Unmarshal(out, &trades); err != nil {
		return nil, fmt.Errorf("decode trades json: %w", err)
	}
	return trades, nil
}

func parserScriptPath() (string, error) {
	if p := os.Getenv("CONGRESS_PTR_PARSER"); p != "" {
		return p, nil
	}
	_, file, _, ok := runtime.Caller(0)
	if !ok {
		return "", fmt.Errorf("cannot locate congress package path")
	}
	// .../ingester/internal/congress/client.go -> .../ingester/scripts/parse_house_ptr.py
	root := filepath.Clean(filepath.Join(filepath.Dir(file), "..", ".."))
	script := filepath.Join(root, "scripts", "parse_house_ptr.py")
	if _, err := os.Stat(script); err != nil {
		return "", fmt.Errorf("parser script not found at %s (set CONGRESS_PTR_PARSER)", script)
	}
	return script, nil
}

// Matches reports whether a filing belongs to a curated politician.
func Matches(f Filing, lastName, district string) bool {
	if !strings.EqualFold(strings.TrimSpace(f.Last), strings.TrimSpace(lastName)) {
		return false
	}
	if district == "" {
		return true
	}
	return strings.EqualFold(strings.TrimSpace(f.StateDst), strings.TrimSpace(district))
}

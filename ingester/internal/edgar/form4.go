package edgar

import (
	"fmt"
	"regexp"
	"strings"
	"time"
)

const currentForm4Feed = "https://www.sec.gov/cgi-bin/browse-edgar?action=getcurrent&type=4&company=&dateb=&owner=include&count=100&output=atom"

// FeedEntry is one filing from the "current filings" Atom feed.
type FeedEntry struct {
	AccessionNo string
	CIK         string // filer CIK from the entry link (may be issuer or owner)
	FormType    string
	Updated     time.Time
	IndexURL    string
}

type atomFeed struct {
	Entries []struct {
		Title    string `xml:"title"`
		Link     struct {
			Href string `xml:"href,attr"`
		} `xml:"link"`
		Updated  string `xml:"updated"`
		Category struct {
			Term string `xml:"term,attr"`
		} `xml:"category"`
	} `xml:"entry"`
}

// e.g. https://www.sec.gov/Archives/edgar/data/1234567/000123456725000123/0001234567-25-000123-index.htm
var indexLinkRe = regexp.MustCompile(`/Archives/edgar/data/(\d+)/.*?(\d{10}-\d{2}-\d{6})-index`)

// LatestForm4Filings returns Form 4 entries from the current-filings feed,
// newest first, de-duplicated by accession number.
func (c *Client) LatestForm4Filings() ([]FeedEntry, error) {
	body, err := c.Get(currentForm4Feed)
	if err != nil {
		return nil, err
	}
	return parseForm4Feed(body)
}

func parseForm4Feed(body []byte) ([]FeedEntry, error) {
	var feed atomFeed
	if err := unmarshalXML(body, &feed); err != nil {
		return nil, fmt.Errorf("parse atom feed: %w", err)
	}
	seen := map[string]bool{}
	var out []FeedEntry
	for _, e := range feed.Entries {
		// The feed includes 4/A amendments and related forms; keep plain 4 and 4/A.
		form := strings.TrimSpace(e.Category.Term)
		if form != "4" && form != "4/A" {
			continue
		}
		m := indexLinkRe.FindStringSubmatch(e.Link.Href)
		if m == nil {
			continue
		}
		acc := m[2]
		if seen[acc] {
			continue
		}
		seen[acc] = true
		updated, _ := time.Parse(time.RFC3339, e.Updated)
		out = append(out, FeedEntry{
			AccessionNo: acc,
			CIK:         m[1],
			FormType:    form,
			Updated:     updated,
			IndexURL:    e.Link.Href,
		})
	}
	return out, nil
}

// ---------------------------------------------------------------------------
// Filing directory index -> ownership XML document
// ---------------------------------------------------------------------------

type filingIndex struct {
	Directory struct {
		Item []struct {
			Name string `json:"name"`
		} `json:"item"`
	} `json:"directory"`
}

// OwnershipXMLURL locates the ownership XML document inside a filing directory.
func (c *Client) OwnershipXMLURL(cik, accessionNo string) (string, error) {
	dir := fmt.Sprintf("https://www.sec.gov/Archives/edgar/data/%s/%s",
		strings.TrimLeft(cik, "0"), strings.ReplaceAll(accessionNo, "-", ""))
	body, err := c.Get(dir + "/index.json")
	if err != nil {
		return "", err
	}
	name, err := pickOwnershipXML(body)
	if err != nil {
		return "", fmt.Errorf("%s: %w", accessionNo, err)
	}
	return dir + "/" + name, nil
}

// ---------------------------------------------------------------------------
// Form 4 ownership document
// ---------------------------------------------------------------------------

// Form4 is a parsed ownership document.
type Form4 struct {
	IssuerCIK    string
	IssuerName   string
	IssuerTicker string

	OwnerCIK          string
	OwnerName         string
	OfficerTitle      string
	IsDirector        bool
	IsOfficer         bool
	IsTenPercentOwner bool

	PeriodOfReport string // YYYY-MM-DD
	Transactions   []Form4Transaction
}

type Form4Transaction struct {
	SecurityTitle     string
	Date              string // YYYY-MM-DD
	Code              string // P, S, A, M, ...
	Shares            float64
	PricePerShare     float64
	AcquiredDisposed  string // A or D
	SharesOwnedAfter  float64
	IsDerivative      bool
}

// XML shapes: most scalar fields are wrapped in <value> elements.
type xmlValue struct {
	Value string `xml:"value"`
}

type xmlBoolValue struct {
	Value string `xml:"value"`
	Text  string `xml:",chardata"`
}

func (b xmlBoolValue) Bool() bool {
	v := strings.TrimSpace(b.Value)
	if v == "" {
		v = strings.TrimSpace(b.Text)
	}
	return v == "1" || strings.EqualFold(v, "true")
}

type xmlTransaction struct {
	SecurityTitle   xmlValue `xml:"securityTitle"`
	TransactionDate xmlValue `xml:"transactionDate"`
	Coding          struct {
		Code string `xml:"transactionCode"`
	} `xml:"transactionCoding"`
	Amounts struct {
		Shares           xmlValue `xml:"transactionShares"`
		PricePerShare    xmlValue `xml:"transactionPricePerShare"`
		AcquiredDisposed xmlValue `xml:"transactionAcquiredDisposedCode"`
	} `xml:"transactionAmounts"`
	PostAmounts struct {
		SharesOwned xmlValue `xml:"sharesOwnedFollowingTransaction"`
	} `xml:"postTransactionAmounts"`
}

type xmlOwnershipDoc struct {
	PeriodOfReport string `xml:"periodOfReport"`
	Issuer         struct {
		CIK    string `xml:"issuerCik"`
		Name   string `xml:"issuerName"`
		Symbol string `xml:"issuerTradingSymbol"`
	} `xml:"issuer"`
	Owners []struct {
		ID struct {
			CIK  string `xml:"rptOwnerCik"`
			Name string `xml:"rptOwnerName"`
		} `xml:"reportingOwnerId"`
		Relationship struct {
			IsDirector        xmlBoolValue `xml:"isDirector"`
			IsOfficer         xmlBoolValue `xml:"isOfficer"`
			IsTenPercentOwner xmlBoolValue `xml:"isTenPercentOwner"`
			OfficerTitle      string       `xml:"officerTitle"`
		} `xml:"reportingOwnerRelationship"`
	} `xml:"reportingOwner"`
	NonDerivative struct {
		Transactions []xmlTransaction `xml:"nonDerivativeTransaction"`
	} `xml:"nonDerivativeTable"`
	Derivative struct {
		Transactions []xmlTransaction `xml:"derivativeTransaction"`
	} `xml:"derivativeTable"`
}

// FetchForm4 downloads and parses the ownership XML for a filing.
func (c *Client) FetchForm4(cik, accessionNo string) (*Form4, error) {
	xmlURL, err := c.OwnershipXMLURL(cik, accessionNo)
	if err != nil {
		return nil, err
	}
	body, err := c.Get(xmlURL)
	if err != nil {
		return nil, err
	}
	return ParseForm4(body)
}

// ParseForm4 parses an ownershipDocument XML.
func ParseForm4(body []byte) (*Form4, error) {
	var doc xmlOwnershipDoc
	if err := unmarshalXML(body, &doc); err != nil {
		return nil, fmt.Errorf("parse form 4 xml: %w", err)
	}
	if doc.Issuer.CIK == "" || len(doc.Owners) == 0 {
		return nil, fmt.Errorf("form 4 xml missing issuer or reporting owner")
	}
	owner := doc.Owners[0] // multi-owner filings: attribute to the primary owner

	f := &Form4{
		IssuerCIK:         PadCIK(doc.Issuer.CIK),
		IssuerName:        strings.TrimSpace(doc.Issuer.Name),
		IssuerTicker:      normalizeTicker(doc.Issuer.Symbol),
		OwnerCIK:          PadCIK(owner.ID.CIK),
		OwnerName:         strings.TrimSpace(owner.ID.Name),
		OfficerTitle:      strings.TrimSpace(owner.Relationship.OfficerTitle),
		IsDirector:        owner.Relationship.IsDirector.Bool(),
		IsOfficer:         owner.Relationship.IsOfficer.Bool(),
		IsTenPercentOwner: owner.Relationship.IsTenPercentOwner.Bool(),
		PeriodOfReport:    strings.TrimSpace(doc.PeriodOfReport),
	}

	for _, t := range doc.NonDerivative.Transactions {
		f.Transactions = append(f.Transactions, toTransaction(t, false))
	}
	for _, t := range doc.Derivative.Transactions {
		f.Transactions = append(f.Transactions, toTransaction(t, true))
	}
	return f, nil
}

func toTransaction(t xmlTransaction, derivative bool) Form4Transaction {
	return Form4Transaction{
		SecurityTitle:    strings.TrimSpace(t.SecurityTitle.Value),
		Date:             strings.TrimSpace(t.TransactionDate.Value),
		Code:             strings.TrimSpace(t.Coding.Code),
		Shares:           parseFloat(t.Amounts.Shares.Value),
		PricePerShare:    parseFloat(t.Amounts.PricePerShare.Value),
		AcquiredDisposed: strings.TrimSpace(t.Amounts.AcquiredDisposed.Value),
		SharesOwnedAfter: parseFloat(t.PostAmounts.SharesOwned.Value),
		IsDerivative:     derivative,
	}
}

// normalizeTicker cleans issuer trading symbols ("NONE", "N/A", lowercase).
func normalizeTicker(s string) string {
	s = strings.ToUpper(strings.TrimSpace(s))
	switch s {
	case "", "NONE", "N/A", "NA":
		return ""
	}
	return s
}

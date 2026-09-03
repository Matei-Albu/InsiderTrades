package edgar

import (
	"encoding/json"
	"fmt"
	"strings"
	"time"
)

// ThirteenFFiling is one 13F-HR filing from an institution's submission history.
type ThirteenFFiling struct {
	AccessionNo    string
	PeriodOfReport string // YYYY-MM-DD quarter end
	FiledAt        time.Time
}

// Holding is one information-table row.
type Holding struct {
	IssuerName string
	ClassTitle string
	CUSIP      string
	Value      float64 // dollars (normalized; pre-2023 filings report thousands)
	Shares     float64
	ShareType  string // SH or PRN
}

type submissionsJSON struct {
	Name    string `json:"name"`
	Filings struct {
		Recent struct {
			AccessionNumber []string `json:"accessionNumber"`
			Form            []string `json:"form"`
			FilingDate      []string `json:"filingDate"`
			ReportDate      []string `json:"reportDate"`
		} `json:"recent"`
	} `json:"filings"`
}

// ThirteenFFilings lists an institution's 13F-HR filings, newest first.
func (c *Client) ThirteenFFilings(cik string) (name string, filings []ThirteenFFiling, err error) {
	url := fmt.Sprintf("https://data.sec.gov/submissions/CIK%s.json", PadCIK(cik))
	body, err := c.Get(url)
	if err != nil {
		return "", nil, err
	}
	var sub submissionsJSON
	if err := json.Unmarshal(body, &sub); err != nil {
		return "", nil, fmt.Errorf("parse submissions json: %w", err)
	}
	rec := sub.Filings.Recent
	for i := range rec.Form {
		if rec.Form[i] != "13F-HR" {
			continue
		}
		filedAt, _ := time.Parse("2006-01-02", rec.FilingDate[i])
		filings = append(filings, ThirteenFFiling{
			AccessionNo:    rec.AccessionNumber[i],
			PeriodOfReport: rec.ReportDate[i],
			FiledAt:        filedAt,
		})
	}
	return sub.Name, filings, nil
}

// infoTable XML shapes (namespace-agnostic via local names).
type xmlInfoTable struct {
	Entries []struct {
		NameOfIssuer string `xml:"nameOfIssuer"`
		TitleOfClass string `xml:"titleOfClass"`
		CUSIP        string `xml:"cusip"`
		Value        string `xml:"value"`
		ShrsOrPrn    struct {
			Amt  string `xml:"sshPrnamt"`
			Type string `xml:"sshPrnamtType"`
		} `xml:"shrsOrPrnAmt"`
	} `xml:"infoTable"`
}

// FetchHoldings downloads and parses the information table of a 13F filing.
func (c *Client) FetchHoldings(cik string, f ThirteenFFiling) ([]Holding, error) {
	dir := fmt.Sprintf("https://www.sec.gov/Archives/edgar/data/%s/%s",
		strings.TrimLeft(cik, "0"), strings.ReplaceAll(f.AccessionNo, "-", ""))
	body, err := c.Get(dir + "/index.json")
	if err != nil {
		return nil, err
	}
	name, err := pickInfoTableXML(body)
	if err != nil {
		return nil, fmt.Errorf("%s: %w", f.AccessionNo, err)
	}
	tableXML, err := c.Get(dir + "/" + name)
	if err != nil {
		return nil, err
	}
	return ParseInfoTable(tableXML, f.PeriodOfReport)
}

// ParseInfoTable parses a 13F information table. Values are normalized to
// dollars: filings for periods before 2023 report value in thousands.
func ParseInfoTable(body []byte, periodOfReport string) ([]Holding, error) {
	var table xmlInfoTable
	if err := unmarshalXML(body, &table); err != nil {
		return nil, fmt.Errorf("parse 13f info table: %w", err)
	}
	multiplier := 1.0
	if periodOfReport != "" && periodOfReport < "2023-01-01" {
		multiplier = 1000.0
	}
	holdings := make([]Holding, 0, len(table.Entries))
	for _, e := range table.Entries {
		holdings = append(holdings, Holding{
			IssuerName: strings.TrimSpace(e.NameOfIssuer),
			ClassTitle: strings.TrimSpace(e.TitleOfClass),
			CUSIP:      strings.ToUpper(strings.TrimSpace(e.CUSIP)),
			Value:      parseFloat(e.Value) * multiplier,
			Shares:     parseFloat(e.ShrsOrPrn.Amt),
			ShareType:  strings.TrimSpace(e.ShrsOrPrn.Type),
		})
	}
	if len(holdings) == 0 {
		return nil, fmt.Errorf("info table contained no holdings")
	}
	return holdings, nil
}

// pickInfoTableXML finds the information-table XML in a 13F filing directory.
// The directory holds primary_doc.xml (cover page) plus the info table, whose
// name varies (infotable.xml, form13fInfoTable.xml, ...).
func pickInfoTableXML(indexJSON []byte) (string, error) {
	var idx filingIndex
	if err := json.Unmarshal(indexJSON, &idx); err != nil {
		return "", fmt.Errorf("parse index.json: %w", err)
	}
	var fallback string
	for _, item := range idx.Directory.Item {
		lower := strings.ToLower(item.Name)
		if !strings.HasSuffix(lower, ".xml") || strings.Contains(lower, "xsl") {
			continue
		}
		if strings.Contains(lower, "primary_doc") || strings.Contains(lower, "primarydoc") {
			continue
		}
		if strings.Contains(lower, "info") || strings.Contains(lower, "table") {
			return item.Name, nil
		}
		fallback = item.Name
	}
	if fallback != "" {
		return fallback, nil
	}
	return "", fmt.Errorf("no info table xml found in filing index")
}

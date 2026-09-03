package edgar

import "testing"

const sampleInfoTable = `<?xml version="1.0" encoding="UTF-8"?>
<informationTable xmlns="http://www.sec.gov/edgar/document/thirteenf/informationtable">
    <infoTable>
        <nameOfIssuer>APPLE INC</nameOfIssuer>
        <titleOfClass>COM</titleOfClass>
        <cusip>037833100</cusip>
        <value>174347467</value>
        <shrsOrPrnAmt>
            <sshPrnamt>915560382</sshPrnamt>
            <sshPrnamtType>SH</sshPrnamtType>
        </shrsOrPrnAmt>
        <investmentDiscretion>DFND</investmentDiscretion>
        <votingAuthority><Sole>915560382</Sole><Shared>0</Shared><None>0</None></votingAuthority>
    </infoTable>
    <infoTable>
        <nameOfIssuer>BANK AMER CORP</nameOfIssuer>
        <titleOfClass>COM</titleOfClass>
        <cusip>060505104</cusip>
        <value>28279487</value>
        <shrsOrPrnAmt>
            <sshPrnamt>1032852006</sshPrnamt>
            <sshPrnamtType>SH</sshPrnamtType>
        </shrsOrPrnAmt>
    </infoTable>
</informationTable>`

func TestParseInfoTable(t *testing.T) {
	holdings, err := ParseInfoTable([]byte(sampleInfoTable), "2026-06-30")
	if err != nil {
		t.Fatalf("ParseInfoTable: %v", err)
	}
	if len(holdings) != 2 {
		t.Fatalf("got %d holdings, want 2", len(holdings))
	}
	h := holdings[0]
	if h.IssuerName != "APPLE INC" || h.CUSIP != "037833100" {
		t.Errorf("holding parsed wrong: %+v", h)
	}
	if h.Value != 174347467 { // post-2023 period: value already in dollars
		t.Errorf("Value = %f, want dollars unchanged", h.Value)
	}
	if h.Shares != 915560382 || h.ShareType != "SH" {
		t.Errorf("shares parsed wrong: %+v", h)
	}
}

func TestParseInfoTablePre2023Thousands(t *testing.T) {
	holdings, err := ParseInfoTable([]byte(sampleInfoTable), "2022-06-30")
	if err != nil {
		t.Fatalf("ParseInfoTable: %v", err)
	}
	if holdings[0].Value != 174347467000 {
		t.Errorf("Value = %f, want thousands normalized to dollars", holdings[0].Value)
	}
}

func TestPickInfoTableXML(t *testing.T) {
	index := `{"directory":{"item":[
        {"name":"primary_doc.xml"},
        {"name":"0001067983-26-000010-index-headers.html"},
        {"name":"form13fInfoTable.xml"},
        {"name":"xslForm13F_X02_form13fInfoTable.xml"}
    ]}}`
	name, err := pickInfoTableXML([]byte(index))
	if err != nil {
		t.Fatalf("pickInfoTableXML: %v", err)
	}
	if name != "form13fInfoTable.xml" {
		t.Errorf("picked %q, want form13fInfoTable.xml", name)
	}
}

func TestNormalizeCompanyName(t *testing.T) {
	cases := map[string]string{
		"APPLE INC":            "apple",
		"Apple Inc.":           "apple",
		"BANK AMER CORP":       "bank amer",
		"Berkshire Hathaway Inc-CL A": "berkshire hathaway",
	}
	for in, want := range cases {
		if got := normalizeCompanyName(in); got != want {
			t.Errorf("normalizeCompanyName(%q) = %q, want %q", in, got, want)
		}
	}
}

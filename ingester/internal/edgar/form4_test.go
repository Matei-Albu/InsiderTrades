package edgar

import "testing"

const sampleForm4XML = `<?xml version="1.0"?>
<ownershipDocument>
    <schemaVersion>X0508</schemaVersion>
    <documentType>4</documentType>
    <periodOfReport>2026-08-28</periodOfReport>
    <issuer>
        <issuerCik>0000320193</issuerCik>
        <issuerName>Apple Inc.</issuerName>
        <issuerTradingSymbol>aapl</issuerTradingSymbol>
    </issuer>
    <reportingOwner>
        <reportingOwnerId>
            <rptOwnerCik>1214156</rptOwnerCik>
            <rptOwnerName>DOE JANE</rptOwnerName>
        </reportingOwnerId>
        <reportingOwnerRelationship>
            <isDirector>0</isDirector>
            <isOfficer>1</isOfficer>
            <isTenPercentOwner>false</isTenPercentOwner>
            <officerTitle>Chief Financial Officer</officerTitle>
        </reportingOwnerRelationship>
    </reportingOwner>
    <nonDerivativeTable>
        <nonDerivativeTransaction>
            <securityTitle><value>Common Stock</value></securityTitle>
            <transactionDate><value>2026-08-27</value></transactionDate>
            <transactionCoding>
                <transactionFormType>4</transactionFormType>
                <transactionCode>P</transactionCode>
                <equitySwapInvolved>0</equitySwapInvolved>
            </transactionCoding>
            <transactionAmounts>
                <transactionShares><value>1000</value></transactionShares>
                <transactionPricePerShare><value>230.50</value></transactionPricePerShare>
                <transactionAcquiredDisposedCode><value>A</value></transactionAcquiredDisposedCode>
            </transactionAmounts>
            <postTransactionAmounts>
                <sharesOwnedFollowingTransaction><value>5000</value></sharesOwnedFollowingTransaction>
            </postTransactionAmounts>
        </nonDerivativeTransaction>
    </nonDerivativeTable>
    <derivativeTable>
        <derivativeTransaction>
            <securityTitle><value>Stock Option (right to buy)</value></securityTitle>
            <transactionDate><value>2026-08-27</value></transactionDate>
            <transactionCoding>
                <transactionFormType>4</transactionFormType>
                <transactionCode>M</transactionCode>
            </transactionCoding>
            <transactionAmounts>
                <transactionShares><value>500</value></transactionShares>
                <transactionPricePerShare><value>100</value></transactionPricePerShare>
                <transactionAcquiredDisposedCode><value>D</value></transactionAcquiredDisposedCode>
            </transactionAmounts>
            <postTransactionAmounts>
                <sharesOwnedFollowingTransaction><value>0</value></sharesOwnedFollowingTransaction>
            </postTransactionAmounts>
        </derivativeTransaction>
    </derivativeTable>
</ownershipDocument>`

func TestParseForm4(t *testing.T) {
	f, err := ParseForm4([]byte(sampleForm4XML))
	if err != nil {
		t.Fatalf("ParseForm4: %v", err)
	}
	if f.IssuerCIK != "0000320193" {
		t.Errorf("IssuerCIK = %q", f.IssuerCIK)
	}
	if f.IssuerTicker != "AAPL" {
		t.Errorf("IssuerTicker = %q, want AAPL", f.IssuerTicker)
	}
	if f.OwnerCIK != "0001214156" {
		t.Errorf("OwnerCIK = %q, want padded to 10 digits", f.OwnerCIK)
	}
	if f.OwnerName != "DOE JANE" {
		t.Errorf("OwnerName = %q", f.OwnerName)
	}
	if !f.IsOfficer || f.IsDirector || f.IsTenPercentOwner {
		t.Errorf("relationship flags wrong: officer=%v director=%v tenpct=%v",
			f.IsOfficer, f.IsDirector, f.IsTenPercentOwner)
	}
	if f.OfficerTitle != "Chief Financial Officer" {
		t.Errorf("OfficerTitle = %q", f.OfficerTitle)
	}
	if len(f.Transactions) != 2 {
		t.Fatalf("got %d transactions, want 2", len(f.Transactions))
	}

	buy := f.Transactions[0]
	if buy.Code != "P" || buy.Shares != 1000 || buy.PricePerShare != 230.50 {
		t.Errorf("buy parsed wrong: %+v", buy)
	}
	if buy.SharesOwnedAfter != 5000 || buy.AcquiredDisposed != "A" || buy.IsDerivative {
		t.Errorf("buy details wrong: %+v", buy)
	}

	deriv := f.Transactions[1]
	if !deriv.IsDerivative || deriv.Code != "M" {
		t.Errorf("derivative parsed wrong: %+v", deriv)
	}
}

const sampleAtomFeed = `<?xml version="1.0" encoding="ISO-8859-1"?>
<feed xmlns="http://www.w3.org/2005/Atom">
    <title>Latest Filings - Wed, 02 Sep 2026 15:00:00 EDT</title>
    <entry>
        <title>4 - DOE JANE (0001214156) (Reporting)</title>
        <link rel="alternate" type="text/html"
              href="https://www.sec.gov/Archives/edgar/data/1214156/000121415626000042/0001214156-26-000042-index.htm"/>
        <category scheme="https://www.sec.gov/" label="form type" term="4"/>
        <updated>2026-09-02T14:58:12-04:00</updated>
    </entry>
    <entry>
        <title>4 - Apple Inc. (0000320193) (Issuer)</title>
        <link rel="alternate" type="text/html"
              href="https://www.sec.gov/Archives/edgar/data/320193/000121415626000042/0001214156-26-000042-index.htm"/>
        <category scheme="https://www.sec.gov/" label="form type" term="4"/>
        <updated>2026-09-02T14:58:12-04:00</updated>
    </entry>
    <entry>
        <title>3 - SMITH JOHN (0009999999) (Reporting)</title>
        <link rel="alternate" type="text/html"
              href="https://www.sec.gov/Archives/edgar/data/9999999/000999999926000001/0009999999-26-000001-index.htm"/>
        <category scheme="https://www.sec.gov/" label="form type" term="3"/>
        <updated>2026-09-02T14:57:00-04:00</updated>
    </entry>
</feed>`

func TestParseForm4Feed(t *testing.T) {
	entries, err := parseForm4Feed([]byte(sampleAtomFeed))
	if err != nil {
		t.Fatalf("parseForm4Feed: %v", err)
	}
	// Two entries share an accession number (issuer + reporting sides of the
	// same filing) and the Form 3 must be excluded.
	if len(entries) != 1 {
		t.Fatalf("got %d entries, want 1 (deduped, form 4 only): %+v", len(entries), entries)
	}
	e := entries[0]
	if e.AccessionNo != "0001214156-26-000042" {
		t.Errorf("AccessionNo = %q", e.AccessionNo)
	}
	if e.CIK != "1214156" {
		t.Errorf("CIK = %q", e.CIK)
	}
	if e.Updated.IsZero() {
		t.Error("Updated not parsed")
	}
}

func TestPickOwnershipXML(t *testing.T) {
	index := `{"directory":{"item":[
        {"name":"0001214156-26-000042-index-headers.html"},
        {"name":"xslF345X05_wk-form4_123.xml"},
        {"name":"wk-form4_1725291492.xml"},
        {"name":"form4.html"}
    ]}}`
	name, err := pickOwnershipXML([]byte(index))
	if err != nil {
		t.Fatalf("pickOwnershipXML: %v", err)
	}
	if name != "wk-form4_1725291492.xml" {
		t.Errorf("picked %q, want the raw (non-xsl) xml", name)
	}
}

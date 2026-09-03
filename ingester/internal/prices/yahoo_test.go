package prices

import "testing"

const sampleChart = `{"chart":{"result":[{
    "meta":{"symbol":"AAPL"},
    "timestamp":[1788007800,1788267000],
    "indicators":{"quote":[{
        "open":[229.01,230.90],
        "high":[231.55,232.00],
        "low":[228.50,null],
        "close":[230.49,231.12],
        "volume":[41234567,38111222]
    }]}
}],"error":null}}`

func TestParseChart(t *testing.T) {
	rows, err := parseChart([]byte(sampleChart))
	if err != nil {
		t.Fatalf("parseChart: %v", err)
	}
	if len(rows) != 2 {
		t.Fatalf("got %d rows, want 2", len(rows))
	}
	if rows[0].Close != 230.49 || rows[0].Volume != 41234567 || rows[0].Date == "" {
		t.Errorf("row parsed wrong: %+v", rows[0])
	}
	if rows[1].Low != 0 { // null bar field tolerated
		t.Errorf("expected zero Low for null value, got %+v", rows[1])
	}
}

func TestParseChartNullClose(t *testing.T) {
	chart := `{"chart":{"result":[{
        "timestamp":[1788007800],
        "indicators":{"quote":[{"open":[1],"high":[1],"low":[1],"close":[null],"volume":[0]}]}
    }],"error":null}}`
	rows, err := parseChart([]byte(chart))
	if err != nil {
		t.Fatalf("parseChart: %v", err)
	}
	if len(rows) != 0 {
		t.Errorf("null close should be skipped, got %+v", rows)
	}
}

func TestParseChartError(t *testing.T) {
	chart := `{"chart":{"result":null,"error":{"code":"Not Found","description":"No data found"}}}`
	if _, err := parseChart([]byte(chart)); err == nil {
		t.Error("expected error for yahoo error response")
	}
}

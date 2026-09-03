package edgar

import (
	"bytes"
	"encoding/json"
	"encoding/xml"
	"fmt"
	"io"
	"strconv"
	"strings"

	"golang.org/x/text/encoding/charmap"
)

// unmarshalXML decodes XML tolerating the non-UTF-8 charsets EDGAR uses
// (the Atom feed declares ISO-8859-1).
func unmarshalXML(body []byte, v any) error {
	dec := xml.NewDecoder(bytes.NewReader(body))
	dec.CharsetReader = func(charset string, input io.Reader) (io.Reader, error) {
		switch strings.ToLower(charset) {
		case "iso-8859-1", "latin1", "windows-1252":
			return charmap.Windows1252.NewDecoder().Reader(input), nil
		default:
			return input, nil // utf-8 and friends
		}
	}
	return dec.Decode(v)
}

// PadCIK zero-pads a CIK to the canonical 10 digits.
func PadCIK(cik string) string {
	cik = strings.TrimSpace(cik)
	if len(cik) >= 10 {
		return cik
	}
	return strings.Repeat("0", 10-len(cik)) + cik
}

func parseFloat(s string) float64 {
	s = strings.ReplaceAll(strings.TrimSpace(s), ",", "")
	if s == "" {
		return 0
	}
	v, err := strconv.ParseFloat(s, 64)
	if err != nil {
		return 0
	}
	return v
}

// pickOwnershipXML picks the ownership document from a filing's index.json.
// Filing directories contain the raw XML plus XSL-rendered copies; we want the raw one.
func pickOwnershipXML(indexJSON []byte) (string, error) {
	var idx filingIndex
	if err := json.Unmarshal(indexJSON, &idx); err != nil {
		return "", fmt.Errorf("parse index.json: %w", err)
	}
	for _, item := range idx.Directory.Item {
		name := item.Name
		lower := strings.ToLower(name)
		if strings.HasSuffix(lower, ".xml") && !strings.Contains(lower, "xsl") {
			return name, nil
		}
	}
	return "", fmt.Errorf("no ownership xml found in filing index")
}

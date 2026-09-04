#!/usr/bin/env python3
"""Parse a House Clerk Periodic Transaction Report PDF into JSON trades.

Reads a PDF path from argv[1], writes a JSON array to stdout.
Requires: pip install pypdf
"""

from __future__ import annotations

import json
import re
import sys

try:
    from pypdf import PdfReader
except ImportError:
    print("pypdf is required: pip install pypdf", file=sys.stderr)
    sys.exit(2)

TYPE_MAP = {
    "P": "purchase",
    "S": "sale",
    "E": "exchange",
    "S (partial)": "sale",
    "P (partial)": "purchase",
    "E (partial)": "exchange",
}

OWNER_MAP = {"": "Self", "SP": "Spouse", "DC": "Dependent Child", "JT": "Joint"}

ASSET_TYPE_MAP = {
    "ST": "Stock",
    "MF": "Mutual Fund",
    "EF": "Exchange Traded Fund",
    "ET": "Exchange Traded Note",
    "OP": "Options",
    "OT": "Other Securities",
    "GS": "Government Securities",
    "CS": "Corporate Bond",
    "CT": "Cryptocurrency",
    "PS": "Private Company Stock",
    "RS": "Restricted Stock",
    "RE": "REIT",
}

# Anchor on the structured type/date/amount columns; asset text precedes them.
ROW_RE = re.compile(
    r"(?P<prefix>.{0,400}?)"
    r"(?:(?P<owner>SP|DC|JT)\s+)?"
    r"(?P<asset>[A-Za-z0-9][^$]{2,200}?)\s+"
    r"(?P<ttype>S\s*\(\s*partial\s*\)|P\s*\(\s*partial\s*\)|E\s*\(\s*partial\s*\)|[PSE])\s+"
    r"(?P<tdate>\d{1,2}/\d{1,2}/\d{4})\s+"
    r"(?P<ndate>\d{1,2}/\d{1,2}/\d{4})\s+"
    r"(?P<amount>Over\s+\$[\d,]+|\$[\d,]+(?:\s*-\s*\$[\d,]+)?)",
    re.IGNORECASE | re.DOTALL,
)

TICKER_RE = re.compile(r"\(([A-Z][A-Z0-9.\-]{0,11})\)")
EXCHANGE_TICKER_RE = re.compile(
    r"\b(?:NYSEARCA|NASDAQ|NYSE|BATS|AMEX|OTC)\s*:\s*([A-Z][A-Z0-9.\-]{0,11})",
    re.IGNORECASE,
)
ASSET_CODE_RE = re.compile(r"\[([A-Z0-9]{2,3})\]\s*$")
AMOUNT_RE = re.compile(
    r"(?:Over\s+)?\$([\d,]+)(?:\s*-\s*\$([\d,]+))?",
    re.IGNORECASE,
)
NOISE_RE = re.compile(
    r"(?:Filing Status|Description|F S:|D:|Comments|Subholding|"
    r"ID Owner Asset|Transaction Type|Notification Date|Cap\.|"
    r"Gains >|\$200\?|Clerk of the House|Name:|Status:|State/District:|"
    r"Digitally Signed|I CERTIFY|\* For the complete)",
    re.IGNORECASE,
)


def extract_text(path: str) -> str:
    reader = PdfReader(path)
    parts = []
    for page in reader.pages:
        t = page.extract_text() or ""
        parts.append(t.replace("\x00", ""))
    return "\n".join(parts)


def parse_amount(raw: str) -> tuple[str, float | None, float | None]:
    cleaned = re.sub(r"\s+", " ", raw).strip()
    m = AMOUNT_RE.search(cleaned)
    if not m:
        return cleaned, None, None
    lo = float(m.group(1).replace(",", ""))
    if cleaned.lower().startswith("over"):
        return f"Over ${m.group(1)}", lo, None
    if m.group(2):
        return f"${m.group(1)} - ${m.group(2)}", lo, float(m.group(2).replace(",", ""))
    return f"${m.group(1)}", lo, lo


def normalize_type(raw: str) -> str:
    key = re.sub(r"\s+", " ", raw.strip())
    key = re.sub(r"\(\s*", "(", key)
    key = re.sub(r"\s*\)", ")", key)
    return TYPE_MAP.get(key, TYPE_MAP.get(key[:1].upper(), "purchase"))


def clean_asset(asset: str) -> tuple[str, str]:
    """Return (asset_name, owner_code)."""
    asset = re.sub(r"\s+", " ", asset).strip()
    parts = NOISE_RE.split(asset)
    asset = parts[-1].strip(" -:;,.|")
    owner = ""
    # Prefer the segment after the last owner code (drops description bleed).
    owners = list(re.finditer(r"\b(SP|DC|JT)\s+", asset))
    if owners:
        owner = owners[-1].group(1)
        asset = asset[owners[-1].end() :]
    return asset[:500], owner


def parse_trades(text: str) -> list[dict]:
    hay = re.sub(r"[ \t]+", " ", text)
    hay = re.sub(r"\n+", " ", hay)
    # Join split amount ranges: "$250,001 - $500,000"
    hay = re.sub(r"(\$[\d,]+)\s*-\s*(\$[\d,]+)", r"\1 - \2", hay)

    trades: list[dict] = []
    for m in ROW_RE.finditer(hay):
        asset, owner_from_asset = clean_asset(m.group("asset"))
        if len(asset) < 3:
            continue
        # Skip header junk that still slipped through.
        if asset.lower().startswith(("type date", "amount", "owner asset")):
            continue

        asset_type = ""
        code_m = ASSET_CODE_RE.search(asset)
        if code_m:
            code = code_m.group(1).upper()
            asset_type = ASSET_TYPE_MAP.get(code, code)
            asset = asset[: code_m.start()].strip()

        ticker = None
        ticks = TICKER_RE.findall(asset)
        if ticks:
            ticker = ticks[-1].upper()
        else:
            em = EXCHANGE_TICKER_RE.search(asset)
            if em:
                ticker = em.group(1).upper()

        # Prefer rows that look like securities (ticker or asset-type code).
        if not ticker and not asset_type:
            continue

        amount_range, amount_min, amount_max = parse_amount(m.group("amount"))
        owner_code = (m.group("owner") or owner_from_asset or "").upper()
        if not owner_code:
            pref = m.group("prefix")[-8:]
            om = re.search(r"\b(SP|DC|JT)\b", pref)
            if om:
                owner_code = om.group(1)

        trades.append(
            {
                "ticker": ticker,
                "asset_name": asset,
                "transaction_type": normalize_type(m.group("ttype")),
                "transaction_date": m.group("tdate"),
                "notification_date": m.group("ndate"),
                "amount_range": amount_range,
                "amount_min": amount_min,
                "amount_max": amount_max,
                "owner": OWNER_MAP.get(owner_code, "Self"),
                "asset_type": asset_type or None,
                "description": None,
            }
        )
    return trades


def main() -> None:
    if len(sys.argv) != 2:
        print("usage: parse_house_ptr.py <pdf-path>", file=sys.stderr)
        sys.exit(2)
    text = extract_text(sys.argv[1])
    if not text.strip():
        print("[]")
        return
    json.dump(parse_trades(text), sys.stdout)


if __name__ == "__main__":
    main()

# InsiderTrades

A web app that monitors insider (SEC Form 4), institutional (13F), and congressional (STOCK Act) trading — a free, self-hosted take on Autopilot-style trade tracking.

- **Feed** of notable open-market insider buys, with significance signals (officer role, cluster badge)
- **Cluster-buy detection** — multiple insiders buying the same stock within 14 days
- **Congress trades** — curated House members' Periodic Transaction Reports (Pelosi, Crenshaw, etc.)
- **Institution portfolios** — quarterly 13F holdings with quarter-over-quarter changes for famous funds
- **Watchlists + email alerts** — get notified when insiders trade stocks you follow
- **Stock pages** — price charts with insider buy/sell markers overlaid

Everything runs on free tiers: SEC EDGAR (data), House Clerk disclosures (Congress), Supabase (Postgres + auth), Vercel (frontend), GitHub Actions (scheduled ingestion), Resend (email), Yahoo Finance (EOD prices).

## Architecture

```
SEC EDGAR ──▶ Go ingester (GitHub Actions cron) ──▶ Supabase Postgres ──▶ Next.js on Vercel
House PTRs ─▶       │
Yahoo EOD  ──▶       │
                     └──▶ Resend (watchlist email alerts)
```

- `web/` — Next.js (App Router, TypeScript, Tailwind), deployed on Vercel
- `ingester/` — Go module: EDGAR Form 4 + 13F, House STOCK Act PTRs, Yahoo Finance prices, alert dispatch
- `supabase/migrations/` — Postgres schema, RLS policies, cluster-buy + congress views
- `.github/workflows/` — CI plus scheduled ingest workflows

## Setup

### 1. Supabase

1. Create a free project at [supabase.com](https://supabase.com).
2. Apply migrations in `supabase/migrations/` in order (SQL editor, or `supabase db push` with the CLI).
3. Note your project URL, anon key, and the **direct/pooler Postgres connection string** (Settings → Database).

### 2. Frontend (local dev)

```bash
cd web
cp .env.example .env.local   # fill in Supabase URL + anon key
npm install
npm run dev
```

### 3. Ingester (local run)

```bash
cd ingester
# Prefer an ingester/.env file, then: set -a && source .env && set +a
export DATABASE_URL="postgres://...supabase pooler url..."
export SEC_USER_AGENT="InsiderTrades your-name you@example.com"  # required by SEC
pip install -r scripts/requirements.txt   # needed for congress PDF parsing

go run ./cmd/ingester form4          # poll latest Form 4 filings
go run ./cmd/ingester backfill13f    # fetch 13F holdings for curated institutions
go run ./cmd/ingester congress       # House STOCK Act PTRs for curated politicians
go run ./cmd/ingester prices         # fetch EOD prices for known tickers
go run ./cmd/ingester alerts         # send watchlist alert emails (needs RESEND_API_KEY)

go run ./cmd/verify                  # smoke-test EDGAR/Yahoo parsing, no database needed
```

### 4. Deployment

- **Vercel**: import the repo, set root directory to `web/`, add env vars from `web/.env.example`.
- **GitHub Actions**: add repository secrets `DATABASE_URL`, `SEC_USER_AGENT`, `RESEND_API_KEY`, `ALERT_FROM_EMAIL`. The scheduled workflows in `.github/workflows/` do the rest.

## Environment variables

| Variable | Used by | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | web | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | web | Supabase anon (public) key |
| `DATABASE_URL` | ingester | Supabase Postgres connection string |
| `SEC_USER_AGENT` | ingester | Required by SEC fair-access policy; include contact email |
| `RESEND_API_KEY` | ingester | Resend API key for alert emails |
| `ALERT_FROM_EMAIL` | ingester | From address for alerts (verified in Resend) |

## Data notes

- Form 4 must be filed within 2 business days of a trade; polling every 15 minutes makes the feed near-real-time relative to the filing, not the trade.
- 13F holdings are quarterly and filed up to 45 days after quarter end.
- Congressional trades come from House Clerk Periodic Transaction Reports (STOCK Act). Amounts are ranges. Scanned paper PDFs may not parse; electronic filings do. Senate / presidential disclosures are not included yet.
- SEC rate limit is 10 req/s and requires a descriptive `User-Agent`; the ingester throttles itself accordingly.

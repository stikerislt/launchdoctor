# Launch Doctor

Shopify embedded app that scans a merchant's store against 50 beginner failure-mode rules and produces a prioritized fix-it report.

## Stack

- Remix + Shopify App Bridge + Polaris
- PostgreSQL (Prisma) + Redis (BullMQ)
- Playwright for mobile/performance checks
- Fly.io deployment

## Local setup

```bash
pnpm install
cp .env.example .env
# Fill in SHOPIFY_API_KEY, SHOPIFY_API_SECRET, DATABASE_URL, REDIS_URL

pnpm prisma migrate dev
pnpm dev
```

`pnpm dev` runs `shopify app dev` with Shopify’s built-in Cloudflare quick tunnel, using the `cloudflared` binary from `node_modules` (more reliable on Windows than the manual two-process setup). In a second terminal:

```bash
pnpm worker
```

## Deploy

Full checklist: **[docs/PRODUCTION.md](docs/PRODUCTION.md)**

```bash
# Configure secrets first (see .env.example)
fly deploy -a launch-doctor
fly scale count worker=1
```

Required secrets:

```bash
fly secrets set \
  DATABASE_URL=... REDIS_URL=... \
  SHOPIFY_API_KEY=... SHOPIFY_API_SECRET=... \
  SHOPIFY_APP_URL=https://your-domain.com APP_URL=https://your-domain.com
```

Then sync Shopify config:

```bash
shopify app deploy
```

Production image includes **Playwright/Chromium** for the audit worker. Health check: `GET /healthz`.

## How to add a new rule

1. Add `audit-engine/rules/NN-code-name.ts` exporting a `Rule` object
2. Register it in `audit-engine/rules/index.ts`
3. Add fixtures in `audit-engine/__tests__/fixtures/rule-fixtures.ts`
4. Run `pnpm test` and `pnpm run lint-rules`

## How to debug a stuck audit

1. Check audit status: `SELECT id, status, "errorMessage" FROM "Audit" WHERE id = '...'`
2. Check worker logs: `fly logs -a launch-doctor --process worker`
3. Verify Redis connection and offline session exists for the shop
4. Re-enqueue: use BullMQ dashboard or restart worker with pending job

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start embedded app |
| `pnpm worker` | Start BullMQ worker |
| `pnpm test` | Jest unit tests (90% coverage on audit-engine) |
| `pnpm run lint-rules` | Validate all 50 rules have fixtures |
| `pnpm typecheck` | TypeScript check |

## Marketing site

Merchant-facing landing page (GitHub Pages, no custom domain): enable `/docs` in [Pages settings](docs/GITHUB_PAGES.md) → `https://stikerislt.github.io/launchdoctor/`

## Public scanner

Visit `/scan/your-store.myshopify.com` for a free 8-check teaser (no OAuth required).

## Billing

- **$19 one-time** — unlock full report + PDF for one audit
- **$9/month Audit Plus** — weekly rescans + theme-change alerts
- **Local dev:** Shopify's Billing API only works for apps with public distribution. In development, unlocks are granted instantly via a dev bypass (no charge). Set `BILLING_DEV_BYPASS=false` to test real billing against a public app install.

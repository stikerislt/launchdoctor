# Production deployment guide

## Architecture

| Component | Role |
|-----------|------|
| **Web** (`pnpm start`) | Remix embedded app — OAuth, UI, webhooks, billing |
| **Worker** (`pnpm worker:prod`) | Postgres job queue — audits, link scans, PageSpeed (no Redis polling) |
| **PostgreSQL** | Prisma — sessions, audits, findings, billing, **background jobs** ([Supabase](SUPABASE.md)) |
| **Redis** | **Not required** (legacy BullMQ removed — avoids Upstash command limits) |
| **HTTPS URL** | Must match `SHOPIFY_APP_URL` and `shopify.app.toml` |

Launch Doctor does **not** modify merchant themes or inject storefront scripts.

## 1. Host the app

Recommended: **Fly.io** (see `fly.toml` + `Dockerfile`).

```bash
fly apps create launch-doctor   # once
fly postgres create           # or attach external DATABASE_URL
fly secrets set \
  SHOPIFY_API_KEY=... \
  SHOPIFY_API_SECRET=... \
  SHOPIFY_APP_URL=https://your-domain.com \
  APP_URL=https://your-domain.com \
  DATABASE_URL=... \
  DIRECT_URL=... \
  SCOPES="read_content,read_files,read_inventory,read_legal_policies,read_locations,read_online_store_pages,read_orders,read_products,read_shipping,read_themes,write_content,write_files,write_inventory,write_products"

# Optional
fly secrets set SENTRY_DSN=... S3_BUCKET=... S3_ACCESS_KEY=... S3_SECRET_KEY=... S3_ENDPOINT=... PDF_SIGN_SECRET=...
# Mobile performance (Google PageSpeed Insights — required for Store Monitor scores)
fly secrets set PAGESPEED_API_KEY=...

fly deploy
fly scale count worker=1
```

- **Health check:** `GET /healthz` → `{ "ok": true }`
- **Web** process: 512MB — always on (`auto_stop_machines = false`)
- **Worker** process: 2GB — Playwright/Chromium

## 2. Shopify Partner configuration

1. Update `shopify.app.toml` `application_url` and `redirect_urls` to your production host (or run `shopify app deploy` after setting env).
2. Deploy extensions/config:
   ```bash
   shopify app deploy
   ```
3. Set app distribution to **public** if you use Shopify Billing ($19 / $9/mo).
4. In production, do **not** set `BILLING_DEV_BYPASS=true` (billing bypass is off when `NODE_ENV=production` unless explicitly enabled).

## 3. Environment variables

See `.env.example`. Required in production:

- `NODE_ENV=production`
- `SHOPIFY_API_KEY`, `SHOPIFY_API_SECRET`
- `SHOPIFY_APP_URL`, `APP_URL` (same HTTPS origin)
- `DATABASE_URL` (and `DIRECT_URL` for migrations)
- `SCOPES` (match `shopify.app.toml`)
- `PAGESPEED_API_KEY` (Google Cloud — PageSpeed Insights API enabled; used on audit worker for mobile performance)

## 4. Database migrations

Runs automatically on web boot via `docker-start` → `prisma migrate deploy`.

Manual:

```bash
pnpm exec prisma migrate deploy
```

## 5. Post-deploy verification

- [ ] Install app on a dev store from production URL
- [ ] Run full audit — worker logs show completion
- [ ] Unlock report / Audit Plus billing (public app)
- [ ] Webhooks: uninstall, GDPR, `themes/publish`
- [ ] `GET https://your-domain.com/healthz`

## 6. Built for Shopify (later)

- Admin CWV (LCP, CLS, INP) need **100+ embedded sessions over 28 days** after launch
- No theme app extension required (admin-only product)
- See prior BFS checklist in team notes

## 7. Operations

```bash
# Web logs
fly logs --process app

# Worker / audit failures
fly logs --process worker

# Stuck audit
# SELECT id, status, "errorMessage" FROM "Audit" WHERE status IN ('PENDING','RUNNING');
```

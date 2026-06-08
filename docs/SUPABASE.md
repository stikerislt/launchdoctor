# Supabase database setup

Launch Doctor uses **PostgreSQL** (via Prisma) for Shopify sessions, stores, audits, and billing.  
Your project API URL (`https://mtsyykxdxabtjdcgbuwo.supabase.co`) is the Supabase API — the app connects with a **database connection string**, not that URL.

Background jobs are queued in **Postgres** (`BackgroundJob` table). You do **not** need Redis/Upstash for the job queue — see [QUEUES.md](QUEUES.md).

## 1. Get connection strings

In [Supabase Dashboard](https://supabase.com/dashboard/project/mtsyykxdxabtjdcgbuwo) → **Project Settings** → **Database** → **Connection string**:

| Use | Supabase mode | Port | Env var |
|-----|---------------|------|---------|
| App + worker (runtime) | **Session pooler** | 5432 | `DATABASE_URL` |
| Prisma migrations | **Session pooler** (direct host is IPv6-only) | 5432 | `DIRECT_URL` |

Copy both strings and replace `[YOUR-PASSWORD]` with your database password.

**Session pooler** (runtime **and** migrations — IPv4 friendly):

Use the **Session** URI from the dashboard. Launch Doctor project example (us-east-1, colocated with Fly `iad`):

```txt
postgresql://postgres.mtsyykxdxabtjdcgbuwo:[PASSWORD]@aws-1-us-east-1.pooler.supabase.com:5432/postgres
```

Use this **same** session-pooler string for both `DATABASE_URL` and `DIRECT_URL`. The dashboard's "Direct" host (`db.<ref>.supabase.co`) is **IPv6-only** and is not reachable from many environments, so we route Prisma migrations through the session pooler too.

URL-encode special characters in the password (`@` → `%40`, `#` → `%23`, etc.). Do not wrap the password in quotes.

**Transaction pooler** (only if you use serverless with many short connections):

Add `?pgbouncer=true` to the URI (port **6543**). Fly.io long-running web + worker usually prefer **Session** or **Direct**.

## 2. Local `.env`

Create `.env` from `.env.example` and set:

```env
DATABASE_URL="<session pooler URI>"
DIRECT_URL="<same session pooler URI>"
```

Keep `.env` out of git (already in `.gitignore`).

## 3. Create tables (migrations)

From the project root:

```bash
pnpm install
pnpm exec prisma generate
pnpm exec prisma migrate deploy
```

You should see four migrations applied (`init`, `fix_dismissals`, `rule_dismissals`, `audit_created_at`).

Verify in Supabase → **Table Editor**: `Store`, `Audit`, `Finding`, `Session`, etc.

## 4. Production (Fly.io)

Set Fly secrets (same values, no quotes in `fly secrets set`):

```bash
fly secrets set DATABASE_URL="..." DIRECT_URL="..."
```

Use the **same** Supabase strings; do not commit passwords to GitHub.

## 5. Supabase MCP (Cursor)

This repo includes [`.cursor/mcp.json`](../.cursor/mcp.json) scoped to project **`mtsyykxdxabtjdcgbuwo`** (database tools, not read-only).

If MCP returns **“You do not have permission to perform this action”**:

1. **Wrong project in global config** — `~/.cursor/mcp.json` may still point at another `project_ref` (e.g. `nfknzkquayqaecbcwzkd`). The workspace file above overrides that for Launch Doctor after you **reload the window** (Cmd/Ctrl+Shift+P → “Developer: Reload Window”).
2. **Re-authenticate** — Cursor → **Settings → Tools & MCP** → Supabase → sign in with the Supabase account that owns `mtsyykxdxabtjdcgbuwo`.
3. **Read-only mode** — `read_only=true` in the MCP URL blocks `apply_migration`. This repo’s MCP URL omits that flag so Prisma-style DDL can run via MCP if needed.

MCP does **not** return your database password or full connection URI. Copy **Session pooler** + **Direct** strings from the dashboard (section 1) into `.env`.

**Prisma (recommended for schema):** set `DATABASE_URL` + `DIRECT_URL`, then `pnpm exec prisma migrate deploy` — no MCP required.

## What Supabase is / isn’t

| Supabase | Launch Doctor |
|----------|----------------|
| Hosted Postgres | All Prisma models |
| Auth, Storage, Realtime | **Not used** — Shopify OAuth handles auth |
| Edge Functions | **Not used** — Remix app on Fly |

You are only using Supabase as a managed Postgres host.

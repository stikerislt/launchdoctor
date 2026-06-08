# Background jobs (Postgres queue)

Launch Doctor queues work in **Supabase/Postgres** (`BackgroundJob` table), not Redis.

## Why not Redis / Upstash?

BullMQ workers poll Redis continuously (blocking pop, stall checks, metadata). With **three always-on workers**, that can exceed **500k Upstash commands/month** before any merchant uses the app.

Postgres polling only runs when the worker is idle:

- Default: one claim attempt every **10 seconds** (~8.6k DB round-trips/month)
- Scales with **actual jobs**, not idle listeners

## How it works

1. Web app inserts a row: `BackgroundJob` with `queue` + `payload` (`PENDING`).
2. Fly **worker** process loops: `claimNextBackgroundJob()` (SKIP LOCKED) → runs job → `COMPLETED` / retry / `FAILED`.
3. Queues: `run-audit`, `link-scan`, `pagespeed-scan`.

## Operations

- **No `REDIS_URL` required** — you can remove it from Fly secrets and pause/delete Upstash.
- Optional: `WORKER_IDLE_POLL_MS` (default `10000`) — lower = snappier UX when queueing scans, slightly more DB polls.

## Local dev

```bash
pnpm worker          # must run alongside pnpm dev for audits/scans to process
```

Without the worker, jobs stay `PENDING` until something processes them.

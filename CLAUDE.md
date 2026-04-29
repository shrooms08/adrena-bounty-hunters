@AGENTS.md

## Server-side services (Phase 2)

Long-running services boot from `instrumentation.ts` → `src/lib/server-init.ts`.
Currently starts: `close-watcher` (auto-claim on Adrena WS close/liquidate events).

- The watcher does NOT auto-start on module import. Only `initServer()` boots it.
- Edge runtime cannot host it (no persistent connections); init is gated on `NEXT_RUNTIME === "nodejs"`.
- Required env: `ADRENA_COMPETITION_API_KEY` (URL-path WS auth). Missing key → watcher logs and disables itself.

To run locally with watcher attached: `npm run dev` — instrumentation fires automatically.

To run tests without touching real services: tests import the modules directly and inject mocks; the server-init path is never triggered. See `scripts/__tests__/_fake-supabase.ts` for the shared DB mock and `scripts/__tests__/close-watcher.test.ts` for the WS mock pattern (real Node EventEmitter cast as AdrenaWsClient).

## Migrations

Plain SQL in `scripts/migrations/`. Apply manually via Supabase SQL editor (no Supabase CLI in use). Files are idempotent (`IF NOT EXISTS`) so re-running is safe. Apply in order — `002_claim_trade_pipeline.sql` then `003_recent_closes_table.sql`.

## Tests

`npx tsx --test scripts/__tests__/*.test.ts` — runs everything via Node's built-in test runner (no jest/vitest).

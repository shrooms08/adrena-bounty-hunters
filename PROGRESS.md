# Bounty Hunters — Production Migration Progress

## Phase 1 Status: Complete

Trade parser foundation against the deployed Adrena program (release/39 IDL). Decoder + composer + indexer + CLI tools, all verified against real mainnet closes (`uEbcTFQ…`, `tQzvuzUP…`, both 226 bytes, no schema warnings).

Phase 1 was superseded by datapi/competition services in Phase 2 — the parser stays on disk as a cold fallback for the case where both upstream services are simultaneously down.

## Phase 2 Status: Substantially Complete (54/54 tests, watcher live but waiting for events)

Two-service integration: `datapi.adrena.trade` (historical) + `adrena-competition-service.onrender.com` (live WS + reference). Single shared claim pipeline used by both the manual claim route and the auto-claim watcher.

### What's Shipped

**HTTP clients (typed, retry, Decimal-precise):**
- `src/lib/adrena-datapi.ts` — `/v4/position`, `/transaction-position`, `/trader-info`, `/trader-profiles`, `/trader-volume`. Decimal at boundary, 429/5xx exponential backoff, AbortSignal cancellation, no body logging.
- `src/lib/adrena-competition.ts` — `/health`, `/size-multiplier`, `/size-multiplier/calculate`, `/position-schema`. URL-path API key. Render cold-start tolerant (60s timeout).

**WebSocket transport:**
- `src/lib/adrena-ws.ts` — singleton, typed events, state machine (`disconnected | connecting | connected | degraded | reconnecting | shutdown`), 1s→30s exponential reconnect, idle detection 90s, listener cleanup on every reconnect, last-info buffered.

**Pure mappers:**
- `src/lib/trade-from-api.ts` — `ApiPosition` → `AdrenaTradeEvent`. Discriminated union return. Anti-exploit `pnl_percent` denominator uses `entry_collateral_amount`, never live `collateral_amount`. JitoSOL→SOL, WBTC→BTC normalization.
- `src/lib/trade-from-ws-event.ts` — `close_position` / `liquidate` WS event → `AdrenaTradeEvent`. Resolves entry collateral via injected `fetchPositionByPda`. Reuses `apiPositionToTradeEvent` after lookup. WS instruction tag is authoritative for close vs liquidate.

**Claim pipeline:**
- `src/lib/claim-trade.ts` — single source of truth. 9-kind discriminated `ClaimResult`. Idempotency, wallet binding, rate limit (3/hr), evaluator, atomic update with race protection, audit-ready insert, best-effort stats upsert. Never throws on expected failures.
- `src/lib/claim-route-handler.ts` + `src/app/api/bounties/claim/route.ts` — refactored. Route is 24 lines; handler does validation + datapi resolution + mapper + claim pipeline + HTTP mapping.

**Background services:**
- `src/lib/close-watcher.ts` — subscribes to WS close/liquidate, audits to `recent_closes` first, runs `claim-trade` in `auto` mode. Tie-break: highest `reward_points` wins. Step 1 errors are loud; steps 2-5 errors log + continue.
- `src/lib/server-init.ts` + `instrumentation.ts` — Next.js boot hook. Watcher starts once per Node process; gated on `NEXT_RUNTIME === 'nodejs'` and `ADRENA_COMPETITION_API_KEY` presence.

**Schema:**
- `scripts/migrations/002_claim_trade_pipeline.sql` — `claims.source` / `evaluator_reasons` / per-trade fields, `bounties.claimed_via`, UNIQUE on `claims.trade_tx`.
- `scripts/migrations/003_recent_closes_table.sql` — audit table with UNIQUE on `tx_signature`, partial index on unprocessed.

**Deps:** `decimal.js`, `ws` + `@types/ws`, `bs58`, `dotenv` (dev only).

### Tests (54 passing)

| File | Tests | Coverage |
|---|---|---|
| `claim-trade.test.ts` | 11 | All 9 ClaimResult kinds + race + arg validation |
| `claim-route.test.ts` | 19 | All 9 ClaimResult kinds → HTTP, validation, datapi paths, DB-error non-leakage |
| `trade-from-api.test.ts` | 8 | Real fixtures, anti-exploit denominator, asset normalization, status guards |
| `trade-from-ws-event.test.ts` | 6 | base64↔base58 round-trip, datapi-miss → skip, defensive pubkey check |
| `close-watcher.test.ts` | 10 | Match/no-match/skip/liquidate/dup, DB-error loudness, gap_warning, idempotent start |

Shared mock: `scripts/__tests__/_fake-supabase.ts`. Real fixtures: `scripts/__tests__/fixtures/position-{108538,107356,104999}.json` + `ws-close-108538.json`.

### Live Verification

- **datapi smoke:** `scripts/cli/test-datapi.ts` — pulls 191 closed positions for `4C9smec…`, $8.34M lifetime volume, 30.81% win rate. ✓
- **competition smoke:** `scripts/cli/test-competition.ts` — health ok, size-multiplier table 8 tiers, calculate(75000)=7×. ✓
- **WS smoke:** `scripts/cli/test-ws-stream.ts` — 20 minutes total stable, programId match, idle timer never fires, 120 keepalive pings, 0 reconnects. **No `position_account` / `close_position` / `liquidate` events flowed in any window** — relay's `data: {}` pings indicate upstream "configured" but Adrena is genuinely quiet (datapi `/trader-volume` also reports 0 for the past month).
- **Manual claim route — local dev:** POST `/api/bounties/claim` returns documented 422 ("transaction-position lookup failed — endpoint pending fix"). Validation 400s also work end-to-end. ✓
- **Manual claim route — deployed (Vercel preview):** `adrena-bounty-hunters-git-production-fd0405-shrooms08s-projects.vercel.app` returns the exact expected 422 envelope on a real wallet + signature payload. **Phase 2 manual claim path is deployed and verified end-to-end.** ✓
- **Migrations:** 002 + 003 applied cleanly to live Supabase. 11 columns on `recent_closes`, 5 indexes including UNIQUE on `tx_signature`. RLS enabled (the watcher uses the service role key which bypasses RLS — explicit policies are a future task).

### Deployment notes (Vercel)

- **Preview URLs are SSO-gated by Vercel deployment protection by default.** Had to disable protection for the smoke test. Re-enable before sharing preview URLs externally; for production-integration, decide whether to leave protection on (and have testers authenticate via Vercel SSO) or off (and rely on app-level auth).
- **Close-watcher will NOT actually run on Vercel serverless.** `instrumentation.ts` fires at function cold-start but Vercel functions die after request idle, taking the WebSocket with them. The manual claim route works on Vercel; the auto-claim watcher needs a separate long-running Node host (Render web service, Railway, fly.io). Until then, auto-claim is unavailable in production — only the manual `POST /api/bounties/claim` path is live.

### Blocked on br0wnD3v

1. **`/transaction-position` returns 400 for every signature we test.** Tried Phase 1 verified close sigs and fresh `last_ix` values from successful `/v4/position` rows. Endpoint exists (Adrena-shaped error envelope, not Fastify default) but rejects input. Manual claim path returns 422 with the documented message until this is fixed.
2. **WS stream is silent.** Relay reports healthy upstream via `data: {}` pings but no Adrena program events flow. Watcher pipeline correct in unit tests; can't end-to-end verify without a live event.

### Deferred (Phase 2.5 / Phase 3)

- **Pyth integration** (`src/lib/pyth-prices.ts`) — needed by alpha-watcher only. Pyth has its own surface area (feed staleness, decimal precision per feed); intentionally separated from watcher work to keep debug surface narrow.
- **Alpha-watcher** (`src/lib/alpha-watcher.ts`) — real-time "highest unrealized PnL%" leader. UI flourish, not v1 critical path.
- **UI work** (`src/components/*`) — claim UX, opt-in for auto-watcher, alpha-of-the-hour panel.
- **Vercel/Render deploy of close-watcher** — Vercel can't host long-running connections; close-watcher needs a separate Node service on Render or similar.
- **`OpenPositionEvent` on-chain decoder validation** — datapi supersedes the need; only revisit if both APIs go down.
- **Two unknown CPI-event discriminators** from Phase 1 — explicitly parked.

### Next Session Goals

1. **Pyth + alpha-watcher.** Build `src/lib/pyth-prices.ts` (Hermes polling, SOL/BTC/BONK feed IDs, 1e6-scale conversion) then `src/lib/alpha-watcher.ts` on top of `position_account` WS subscription + Pyth marks. UI flourish for "highest unrealized PnL%" panel.
2. **Decide on watcher hosting.** Options: Render web service (free tier sleeps; aligns with Adrena's relay), Railway (cheaper persistent), fly.io (regional, more control). Pick one and stand up the close-watcher there with the same env vars as Vercel + `SUPABASE_SERVICE_ROLE_KEY`. Vercel keeps the manual claim route only.
3. **UI integration.** Surface claim history, hunt log, alpha leaderboard. Wire the `claim` route into the existing UI (`src/components/CallYourShot.tsx`, `bounty-board.tsx`, etc — currently uncommitted UI edits will need rebase or merge).
4. **Outstanding upstream items (still on br0wnD3v):**
   - `/transaction-position` 400ing on every signature → manual claim route can't proceed past the documented 422.
   - WS relay healthy but Adrena program events not flowing → watcher can't be verified live until activity resumes.
5. **First live receipt for the watcher.** Once watcher is hosted somewhere persistent AND Adrena events are flowing, watch one real `close_position` event flow end-to-end: WS event → `recent_closes` row → claim row → `bounty.status='claimed'`. Until that receipt exists, the watcher is "verified-by-test, not verified-by-prod".

### Commits

- `a87b410` — Phase 1 parser
- `e3bdcc5` — Phase 1 PROGRESS.md
- `dc754c4` — Phase 2 services + claim pipeline + close-watcher + tests (54 passing)

# Bounty Hunters — Production Migration Progress

## Phase 1 Status: Substantially Complete

### What's Built

- `scripts/constants/adrena.ts` — program ID, mint→asset, side→direction, USD scaling
- `scripts/parsers/event-decoder.ts` — BorshEventCoder against release/39 IDL with snake→camel renamer at decode boundary
- `scripts/parsers/tx-parser.ts` — `getTransaction` wrapper + `findOpenForCloseEvent` fallback
- `scripts/parsers/trade-composer.ts` — pure join with discriminated union result, anti-exploit PnL%
- `scripts/parsers/schema-check.ts` — byte-length validation (226 close / 174 open)
- `scripts/indexer/sink.ts`, `subscribe.ts`, `backfill.ts` — pluggable indexer with `MemoryAndLogSink` default
- `scripts/cli/parse-close-tx.ts`, `test-evaluate.ts` — CLI tools

### Verified Against Real Mainnet Data

- Close txs `uEbcTFQ...` and `tQzvuzUP...` decoded cleanly, all 226 bytes accounted for
- BTC longs with realistic funding-received values, pool type 0

### Architecture Decision Pending

- Adrena confirmed `datapi.adrena.trade` exists as their internal data API
- br0wnD3v sharing route sheet
- If API returns join-ready trade data, the entire `indexer/` folder becomes optional
- Parser stays valuable as a verification layer regardless

### Known Open Items (Non-Blockers)

- Two unknown event discriminators (`40c6cde8260871e2` and `1170de98c0d07c67`) seen in mixed CPI logs — likely from oracle or staking program, not Adrena
- OpenPositionEvent decoder built but not yet validated against a real open tx (pending API decision)

### Next Session Goals

1. Receive route sheet from br0wnD3v
2. Probe `datapi.adrena.trade` with proper params
3. Decide: API-first or indexer-first
4. Begin Phase 2 (wire parsed events into claim route)

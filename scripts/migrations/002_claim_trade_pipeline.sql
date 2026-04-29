-- Phase 2 — claim-trade pipeline schema additions.
--
-- Adds the columns the new claim pipeline writes: source (manual/auto for
-- audit), evaluator_reasons (the pass/fail array from bounty-evaluator),
-- and claimed_via on bounties (mirrors source so leaderboards can filter).
--
-- Also enforces idempotency at the DB layer via a UNIQUE index on
-- claims.trade_tx — even if app logic ever skips the dedupe check, the DB
-- refuses to insert a duplicate. Critical for the auto-claim path where
-- the same WS event might arrive twice on reconnect.
--
-- Idempotent (IF NOT EXISTS / DO NOTHING) so we can re-run safely.

-- claims.source: 'manual' for user-submitted, 'auto' for close-watcher.
ALTER TABLE claims
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'manual';

-- claims.evaluator_reasons: array of "✓"/"✗ ..." strings from evaluateTrade.
ALTER TABLE claims
  ADD COLUMN IF NOT EXISTS evaluator_reasons jsonb;

-- claims columns that the Claim type already declares — verify presence,
-- add if missing. (The TS type at src/types/index.ts:31-45 included these
-- since Phase 0; the existing INSERT did not populate them.)
ALTER TABLE claims
  ADD COLUMN IF NOT EXISTS pnl_percent numeric;
ALTER TABLE claims
  ADD COLUMN IF NOT EXISTS asset text;
ALTER TABLE claims
  ADD COLUMN IF NOT EXISTS direction text;
ALTER TABLE claims
  ADD COLUMN IF NOT EXISTS leverage numeric;
ALTER TABLE claims
  ADD COLUMN IF NOT EXISTS duration_minutes numeric;

-- bounties.claimed_via: mirrors claims.source on the bounty row so we can
-- query "bounties claimed by the auto-watcher" without joining.
ALTER TABLE bounties
  ADD COLUMN IF NOT EXISTS claimed_via text;

-- One signature can claim at most one bounty.
CREATE UNIQUE INDEX IF NOT EXISTS idx_claims_trade_tx_unique
  ON claims (trade_tx);

-- Phase 2 — close-watcher audit table.
--
-- Every WS close_position / liquidate event is persisted here BEFORE any
-- downstream work runs. This is the audit trail and the reconnect-gap
-- visibility surface — if the watcher crashes mid-pipeline, this row tells
-- ops "we saw the event, here's how far we got".
--
-- Idempotency is enforced at DB level via UNIQUE on tx_signature. The WS
-- can deliver the same event twice on reconnect; the second insert hits
-- the unique violation and the app silently no-ops.
--
-- Idempotent (IF NOT EXISTS / DO NOTHING) so we can re-run safely.

CREATE TABLE IF NOT EXISTS recent_closes (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tx_signature        text NOT NULL UNIQUE,
  position_pda        text NOT NULL,
  position_id_onchain text NOT NULL,
  wallet              text NOT NULL,
  event_kind          text NOT NULL CHECK (event_kind IN ('close', 'liquidate')),
  raw_payload         jsonb NOT NULL,
  received_at         timestamptz NOT NULL DEFAULT now(),
  processed_at        timestamptz,
  claim_result_kind   text,
  -- claim_id is the resulting claims.id when a bounty was awarded. Stored
  -- as text rather than a foreign key because we do not know the claims.id
  -- type with certainty (uuid vs text varies by Supabase project).
  claim_id            text
);

CREATE INDEX IF NOT EXISTS idx_recent_closes_position_pda
  ON recent_closes (position_pda);

CREATE INDEX IF NOT EXISTS idx_recent_closes_wallet
  ON recent_closes (wallet);

-- Lookup pattern for ops: "what's still unprocessed?"
CREATE INDEX IF NOT EXISTS idx_recent_closes_unprocessed
  ON recent_closes (received_at)
  WHERE processed_at IS NULL;

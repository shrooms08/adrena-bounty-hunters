#!/usr/bin/env tsx
// Tests for src/lib/claim-route-handler.ts.
//
// We invoke the handler directly with a constructed Request object and
// injected dependencies (no Next.js runtime, no real datapi, no real DB).
//
// Run: npx tsx --test scripts/__tests__/claim-route.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";
import { Decimal } from "decimal.js";
import type {
  ApiPosition,
  ApiTransactionPosition,
} from "@/lib/adrena-datapi";
import type { BountyRow } from "@/types";

import {
  handleClaim,
  type ClaimRouteDeps,
} from "@/lib/claim-route-handler";
import type { Evaluator } from "@/lib/claim-trade";
import { FakeSupabase, asSupabase } from "./_fake-supabase";

// ===========================================================================
// Helpers
// ===========================================================================

const WALLET = "BEG3gUbuzgfc8gAoKx3rN1U2bv9EWkseo99QU3w8322A";
const SIGNATURE =
  "PMsbdSgyvrr7He3wiixvKH85YgW5PNnucjrtSzPNXW5oZZJztbxoCyn9qnfNsymihXLJc2YJdcx9Hoqs7nCKEvG";
const BOUNTY_ID = "bounty-test-1";

function makeRequest(body: unknown): Request {
  return new Request("http://test/api/bounties/claim", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

function makeBounty(overrides: Partial<BountyRow> = {}): BountyRow {
  return {
    id: BOUNTY_ID,
    title: "Test bounty",
    description: "test",
    asset: "SOL",
    direction: "LONG",
    min_pnl_percent: null,
    max_pnl_percent: null,
    min_leverage: null,
    max_leverage: null,
    max_duration_minutes: null,
    min_position_size_usd: 0,
    tier: "common",
    reward_points: 50,
    status: "active",
    claimed_by: null,
    claimed_at: null,
    claimed_trade_tx: null,
    created_at: "2026-01-01T00:00:00.000Z",
    expires_at: "2030-01-01T00:00:00.000Z",
    ...overrides,
  };
}

// Real datapi shape (snake_case + Decimal numerics) — see ApiPosition in
// src/lib/adrena-datapi.ts. We only fill what the route actually reads.
function makeApiPosition(): ApiPosition {
  const d = (n: number) => new Decimal(n);
  return {
    position_id: 108538,
    pool_id: 1,
    user_id: 422178,
    symbol: "JitoSOL",
    token_account_mint: "J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn",
    side: "long",
    status: "close",
    pubkey: "GZ9XfWwgTRhkma2Y91Q9r1XKotNXYjBnKKabj19rhT71",
    entry_price: d(114.09356475),
    exit_price: d(115.55468092),
    entry_size: d(198.517164),
    increase_size: d(0),
    decrease_size: d(0),
    close_size: d(198.517164),
    exit_size: d(198.517164),
    pnl: d(2.262936),
    decrease_pnl: d(0),
    close_pnl: d(2.262936),
    entry_leverage: d(10.143),
    lowest_leverage: d(10.143),
    entry_date: "2026-03-04T14:15:19.000Z",
    exit_date: "2026-03-04T14:33:06.000Z",
    fees: d(0.279333),
    total_decrease_fees: d(0),
    total_close_fees: d(0.279333),
    borrow_fees: d(0.000013),
    decrease_borrow_fees: d(0),
    close_borrow_fees: d(0.000013),
    exit_fees: d(0.27932),
    decrease_exit_fees: d(0),
    close_exit_fees: d(0.27932),
    funding_paid_usd: null,
    funding_received_usd: null,
    last_ix: SIGNATURE,
    entry_collateral_amount: d(19.851716),
    entry_collateral_amount_native: d(0.174869405),
    increase_collateral_amount: d(0),
    increase_collateral_amount_native: d(0),
    decrease_collateral_amount: d(0),
    decrease_collateral_amount_native: d(0),
    close_collateral_amount: d(19.851716),
    close_collateral_amount_native: d(0.190426114),
    collateral_amount: d(19.851716),
    collateral_amount_native: d(0.190426114),
    exit_amount_native: d(0.190426114),
    closed_by_sl_tp: false,
    volume: d(397.034328),
    duration: 1067,
    pnl_volume_ratio: d(0.56996),
    points_pnl_volume_ratio: d(0.028417),
    points_duration: d(0.000204),
    close_size_multiplier: d(0.00972),
    points_mutations: d(0),
    total_points: d(0.00027828),
    created_at: "2026-03-04T14:15:32.728Z",
    updated_at: "2026-03-04T14:33:20.492Z",
  };
}

const PASS_EVALUATOR: Evaluator = () => ({
  matches: true,
  reasons: ["✓ Status: active"],
});

const FAIL_EVALUATOR: Evaluator = () => ({
  matches: false,
  reasons: ["PnL too low: 5% < min 10%"],
});

interface Scenario {
  evaluator?: Evaluator;
  txPos?: ApiTransactionPosition | "throw" | "null-wallet";
  position?: ApiPosition | null | "throw";
  seedBounty?: BountyRow | null;
  preSeedClaim?: { signature: string; bountyId?: string };
  raceMutate?: boolean;
}

function buildDeps(scenario: Scenario = {}): {
  deps: ClaimRouteDeps;
  fake: FakeSupabase;
} {
  const fake = new FakeSupabase();

  if (scenario.seedBounty !== null) {
    const b = scenario.seedBounty ?? makeBounty();
    fake.bounties.set(b.id, { ...b });
  }
  if (scenario.preSeedClaim) {
    fake.claims.push({
      id: "pre-claim",
      bounty_id: scenario.preSeedClaim.bountyId ?? "some-bounty",
      wallet: WALLET,
      trade_tx: scenario.preSeedClaim.signature,
      claimed_at: new Date().toISOString(),
    });
  }
  if (scenario.raceMutate) {
    fake.beforeBountyUpdate = () => {
      const row = fake.bounties.get(BOUNTY_ID);
      if (row) row.status = "claimed";
    };
  }

  const deps: ClaimRouteDeps = {
    supabase: asSupabase(fake),
    fetchPositionBySignature: async () => {
      if (scenario.txPos === "throw") {
        throw new Error("simulated 400 from /transaction-position");
      }
      if (scenario.txPos === "null-wallet") {
        return {
          position_id: 108538,
          position_pubkey: "GZ9XfWwgTRhkma2Y91Q9r1XKotNXYjBnKKabj19rhT71",
          method: "closePositionLong",
          transaction_date: "2026-03-04T14:33:06.000Z",
          slot: 1,
          side: "long",
          user_wallet: "DIFFERENT_WALLET_111111111111111111111111111",
        };
      }
      return (
        scenario.txPos ?? {
          position_id: 108538,
          position_pubkey: "GZ9XfWwgTRhkma2Y91Q9r1XKotNXYjBnKKabj19rhT71",
          method: "closePositionLong",
          transaction_date: "2026-03-04T14:33:06.000Z",
          slot: 1,
          side: "long",
          user_wallet: WALLET,
        }
      );
    },
    fetchPositionByPubkey: async () => {
      if (scenario.position === "throw") {
        throw new Error("simulated /v4/position 503");
      }
      if (scenario.position === null) return null;
      return scenario.position ?? makeApiPosition();
    },
    evaluator: scenario.evaluator ?? PASS_EVALUATOR,
  };

  return { deps, fake };
}

const VALID_BODY = {
  bounty_id: BOUNTY_ID,
  wallet: WALLET,
  signature: SIGNATURE,
};

// ===========================================================================
// Validation tests
// ===========================================================================

test("400 on invalid JSON body", async () => {
  const { deps } = buildDeps();
  const req = new Request("http://test/api/bounties/claim", {
    method: "POST",
    body: "{not json",
  });
  const r = await handleClaim(req, deps);
  assert.equal(r.status, 400);
  assert.match(String(r.body.error), /invalid json/i);
});

test("400 on missing fields with field-level errors", async () => {
  const { deps } = buildDeps();
  const r = await handleClaim(makeRequest({}), deps);
  assert.equal(r.status, 400);
  assert.equal(r.body.error, "Invalid request");
  const fields = r.body.fields as Record<string, string>;
  assert.equal(fields.bounty_id, "required");
  assert.equal(fields.wallet, "required");
  assert.equal(fields.signature, "required");
});

test("400 on wallet that isn't valid base58 length", async () => {
  const { deps } = buildDeps();
  const r = await handleClaim(
    makeRequest({ ...VALID_BODY, wallet: "tooshort" }),
    deps,
  );
  assert.equal(r.status, 400);
  const fields = r.body.fields as Record<string, string>;
  assert.match(fields.wallet, /invalid base58 wallet/i);
});

test("400 on signature with non-base58 characters", async () => {
  const { deps } = buildDeps();
  const r = await handleClaim(
    makeRequest({
      ...VALID_BODY,
      signature: "0".repeat(SIGNATURE.length), // '0' is not in base58 alphabet
    }),
    deps,
  );
  assert.equal(r.status, 400);
});

// ===========================================================================
// Datapi resolution tests
// ===========================================================================

test("422 when the signature → position lookup throws", async () => {
  const { deps } = buildDeps({ txPos: "throw" });
  const r = await handleClaim(makeRequest(VALID_BODY), deps);
  assert.equal(r.status, 422);
  assert.match(String(r.body.error), /position lookup failed/i);
  assert.equal(r.body.signature, SIGNATURE);
});

test("422 when transaction wallet does not match claim wallet", async () => {
  const { deps } = buildDeps({ txPos: "null-wallet" });
  const r = await handleClaim(makeRequest(VALID_BODY), deps);
  assert.equal(r.status, 422);
  assert.match(String(r.body.error), /does not belong to claiming wallet/i);
});

test("503 when /v4/position lookup throws", async () => {
  const { deps } = buildDeps({ position: "throw" });
  const r = await handleClaim(makeRequest(VALID_BODY), deps);
  assert.equal(r.status, 503);
});

test("422 when datapi has no row for the position (indexing lag)", async () => {
  const { deps } = buildDeps({ position: null });
  const r = await handleClaim(makeRequest(VALID_BODY), deps);
  assert.equal(r.status, 422);
  assert.match(String(r.body.error), /indexing lag/i);
});

test("422 when position is a liquidation", async () => {
  const liq = makeApiPosition();
  liq.status = "liquidate";
  liq.pnl = new Decimal(-10);
  const { deps } = buildDeps({ position: liq });
  const r = await handleClaim(makeRequest(VALID_BODY), deps);
  assert.equal(r.status, 422);
  assert.match(String(r.body.error), /liquidations cannot claim/i);
});

test("422 when mapper skips (e.g. unsupported symbol)", async () => {
  const odd = makeApiPosition();
  odd.symbol = "DOGE";
  const { deps } = buildDeps({ position: odd });
  const r = await handleClaim(makeRequest(VALID_BODY), deps);
  assert.equal(r.status, 422);
  assert.match(String(r.body.reason), /unsupported symbol/i);
});

// ===========================================================================
// ClaimResult → HTTP mapping (one test per kind)
// ===========================================================================

test("200 on success with claim_id and points", async () => {
  const { deps, fake } = buildDeps();
  const r = await handleClaim(makeRequest(VALID_BODY), deps);
  assert.equal(r.status, 200);
  assert.equal(r.body.success, true);
  assert.match(String(r.body.claim_id), /^claim-/);
  assert.equal(r.body.points, 50);
  assert.equal(fake.bounties.get(BOUNTY_ID)?.status, "claimed");
});

test("404 on bounty_not_found", async () => {
  const { deps } = buildDeps({ seedBounty: null });
  const r = await handleClaim(makeRequest(VALID_BODY), deps);
  assert.equal(r.status, 404);
  assert.equal(r.body.error, "Bounty not found");
});

test("409 on bounty_inactive", async () => {
  const { deps } = buildDeps({
    seedBounty: makeBounty({ status: "claimed" }),
  });
  const r = await handleClaim(makeRequest(VALID_BODY), deps);
  assert.equal(r.status, 409);
  assert.equal(r.body.status, "claimed");
});

test("410 on bounty_expired", async () => {
  const { deps } = buildDeps({
    seedBounty: makeBounty({ expires_at: "2020-01-01T00:00:00.000Z" }),
  });
  const r = await handleClaim(makeRequest(VALID_BODY), deps);
  assert.equal(r.status, 410);
});

test("429 on rate_limited", async () => {
  const { deps, fake } = buildDeps();
  const nowIso = new Date().toISOString();
  for (let i = 0; i < 3; i++) {
    fake.claims.push({
      id: `seed-${i}`,
      wallet: WALLET,
      trade_tx: `seed-${i}`,
      claimed_at: nowIso,
    });
  }
  const r = await handleClaim(makeRequest(VALID_BODY), deps);
  assert.equal(r.status, 429);
  assert.equal(r.body.retry_after_seconds, 3600);
});

test("422 on evaluator_rejected with reasons", async () => {
  const { deps } = buildDeps({ evaluator: FAIL_EVALUATOR });
  const r = await handleClaim(makeRequest(VALID_BODY), deps);
  assert.equal(r.status, 422);
  assert.deepEqual(r.body.reasons, ["PnL too low: 5% < min 10%"]);
});

test("409 on race_lost", async () => {
  const { deps } = buildDeps({ raceMutate: true });
  const r = await handleClaim(makeRequest(VALID_BODY), deps);
  assert.equal(r.status, 409);
  assert.match(String(r.body.error), /claimed by another trader/i);
});

test("409 on duplicate_signature with existing_claim_id", async () => {
  const { deps } = buildDeps({
    preSeedClaim: { signature: SIGNATURE },
  });
  const r = await handleClaim(makeRequest(VALID_BODY), deps);
  assert.equal(r.status, 409);
  assert.match(String(r.body.error), /already claimed/i);
  assert.equal(r.body.existing_claim_id, "pre-claim");
});

test("500 on database_error does NOT leak the underlying message", async () => {
  // Force a database_error by monkey-patching the supabase client to throw
  // on the first claims select.
  const { deps, fake } = buildDeps();
  const realFrom = fake.from.bind(fake);
  let calls = 0;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (fake as any).from = (table: string) => {
    calls += 1;
    if (calls === 1) {
      // Return an object whose select().eq().maybeSingle() throws with a
      // sensitive string we want to ensure is NOT reflected.
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => {
              throw new Error("SECRET_DB_ERROR_DETAILS");
            },
          }),
        }),
      };
    }
    return realFrom(table);
  };

  const r = await handleClaim(makeRequest(VALID_BODY), deps);
  assert.equal(r.status, 500);
  assert.equal(r.body.error, "Internal error");
  assert.equal(
    JSON.stringify(r.body).includes("SECRET_DB_ERROR_DETAILS"),
    false,
    "response body must not leak underlying DB error message",
  );
});

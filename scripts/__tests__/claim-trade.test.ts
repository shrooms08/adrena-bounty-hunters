#!/usr/bin/env tsx
// Unit tests for src/lib/claim-trade.ts.
//
// We inject a tiny in-memory FakeSupabase that mimics just the chain
// methods claim-trade uses: from().select().eq().gte().maybeSingle()/.single(),
// from().insert(), from().update().eq().eq().select(), from().upsert().
// This lets us exercise the full pipeline (idempotency, race protection,
// rate limit, evaluator, atomic update, audit insert) without a real DB.
//
// Run: npx tsx --test scripts/__tests__/claim-trade.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";
import type { AdrenaTradeEvent, Bounty } from "@/types";

import { claimTrade, type Evaluator } from "@/lib/claim-trade";
import { FakeSupabase, asSupabase } from "./_fake-supabase";

// ===========================================================================
// Test helpers
// ===========================================================================

const WALLET = "BEG3gUbuzgfc8gAoKx3rN1U2bv9EWkseo99QU3w8322A";

function makeBounty(overrides: Partial<Bounty> = {}): Bounty {
  return {
    id: "bounty-1",
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

function makeTrade(overrides: Partial<AdrenaTradeEvent> = {}): AdrenaTradeEvent {
  return {
    wallet: WALLET,
    asset: "SOL",
    direction: "LONG",
    entry_price: 100,
    exit_price: 110,
    leverage: 5,
    position_size_usd: 500,
    pnl_usd: 50,
    pnl_percent: 50,
    duration_minutes: 30,
    open_timestamp: 1741000000,
    close_timestamp: 1741001800,
    tx_signature: "sig-A",
    ...overrides,
  };
}

const PASS_EVALUATOR: Evaluator = () => ({
  matches: true,
  reasons: ["✓ Status: active", "✓ Asset: SOL"],
});

const FAIL_EVALUATOR: Evaluator = () => ({
  matches: false,
  reasons: ["PnL too low: 5% < min 10%"],
});

// ===========================================================================
// Tests
// ===========================================================================

test("happy path: claim succeeds, bounty marked claimed, claim row inserted", async () => {
  const fake = new FakeSupabase();
  const bounty = makeBounty();
  fake.bounties.set(bounty.id, { ...bounty });

  const result = await claimTrade({
    bountyId: bounty.id,
    wallet: WALLET,
    source: "manual",
    trade: makeTrade(),
    supabase: asSupabase(fake),
    evaluator: PASS_EVALUATOR,
  });

  assert.equal(result.kind, "success");
  assert.ok(result.kind === "success");
  assert.equal(result.points, 50);

  const stored = fake.bounties.get(bounty.id);
  assert.equal(stored?.status, "claimed");
  assert.equal(stored?.claimed_by, WALLET);
  assert.equal(stored?.claimed_via, "manual");

  assert.equal(fake.claims.length, 1);
  const claim = fake.claims[0];
  assert.equal(claim.source, "manual");
  assert.deepEqual(claim.evaluator_reasons, [
    "✓ Status: active",
    "✓ Asset: SOL",
  ]);
  assert.equal(claim.pnl_percent, 50);
  assert.equal(claim.asset, "SOL");
  assert.equal(claim.direction, "LONG");
  assert.equal(claim.leverage, 5);
  assert.equal(claim.duration_minutes, 30);

  const stats = fake.user_stats.get(WALLET);
  assert.equal(stats?.total_claims, 1);
  assert.equal(stats?.total_points, 50);
});

test("duplicate signature: replay returns kind='duplicate_signature'", async () => {
  const fake = new FakeSupabase();
  fake.bounties.set("bounty-1", { ...makeBounty() });

  const trade = makeTrade({ tx_signature: "dup-sig" });

  const first = await claimTrade({
    bountyId: "bounty-1",
    wallet: WALLET,
    source: "manual",
    trade,
    supabase: asSupabase(fake),
    evaluator: PASS_EVALUATOR,
  });
  assert.equal(first.kind, "success");

  // Add a second active bounty so the second attempt isn't blocked by
  // bounty_inactive (which would mask the dedupe check).
  fake.bounties.set("bounty-2", { ...makeBounty({ id: "bounty-2" }) });

  const second = await claimTrade({
    bountyId: "bounty-2",
    wallet: WALLET,
    source: "manual",
    trade,
    supabase: asSupabase(fake),
    evaluator: PASS_EVALUATOR,
  });

  assert.equal(second.kind, "duplicate_signature");
  assert.ok(second.kind === "duplicate_signature");
  assert.match(String(second.existingClaimId), /^claim-/);
});

test("race condition: bounty changes from active to claimed mid-call → kind='race_lost'", async () => {
  const fake = new FakeSupabase();
  const bounty = makeBounty();
  fake.bounties.set(bounty.id, { ...bounty });

  // Hook simulates another claim winning the atomic update. The first
  // (and only the first) bounties UPDATE will see this hook fire and
  // mutate the row out from under it.
  fake.beforeBountyUpdate = () => {
    const row = fake.bounties.get(bounty.id);
    if (row) {
      row.status = "claimed";
      row.claimed_by = "other-wallet";
    }
  };

  const result = await claimTrade({
    bountyId: bounty.id,
    wallet: WALLET,
    source: "manual",
    trade: makeTrade(),
    supabase: asSupabase(fake),
    evaluator: PASS_EVALUATOR,
  });

  assert.equal(result.kind, "race_lost");
  assert.equal(fake.claims.length, 0, "must not insert a claim row when race is lost");
});

test("wallet mismatch: trade.wallet !== claim wallet → kind='evaluator_rejected'", async () => {
  const fake = new FakeSupabase();
  fake.bounties.set("bounty-1", { ...makeBounty() });

  const result = await claimTrade({
    bountyId: "bounty-1",
    wallet: WALLET,
    source: "manual",
    trade: makeTrade({ wallet: "DIFFERENT_WALLET_111111111111111111111111111" }),
    supabase: asSupabase(fake),
    evaluator: PASS_EVALUATOR,
  });

  assert.equal(result.kind, "evaluator_rejected");
  assert.ok(result.kind === "evaluator_rejected");
  assert.match(result.reasons[0], /wallet mismatch/i);
});

test("bounty already claimed: status='claimed' → kind='bounty_inactive'", async () => {
  const fake = new FakeSupabase();
  fake.bounties.set("bounty-1", {
    ...makeBounty({ status: "claimed", claimed_by: "someone-else" }),
  });

  const result = await claimTrade({
    bountyId: "bounty-1",
    wallet: WALLET,
    source: "manual",
    trade: makeTrade(),
    supabase: asSupabase(fake),
    evaluator: PASS_EVALUATOR,
  });

  assert.equal(result.kind, "bounty_inactive");
  assert.ok(result.kind === "bounty_inactive");
  assert.equal(result.status, "claimed");
});

test("bounty expired: expires_at in past → kind='bounty_expired'", async () => {
  const fake = new FakeSupabase();
  fake.bounties.set("bounty-1", {
    ...makeBounty({ expires_at: "2020-01-01T00:00:00.000Z" }),
  });

  const result = await claimTrade({
    bountyId: "bounty-1",
    wallet: WALLET,
    source: "manual",
    trade: makeTrade(),
    supabase: asSupabase(fake),
    evaluator: PASS_EVALUATOR,
  });

  assert.equal(result.kind, "bounty_expired");
});

test("rate limit: 3 claims in last hour → 4th is rate_limited", async () => {
  const fake = new FakeSupabase();
  fake.bounties.set("bounty-target", { ...makeBounty({ id: "bounty-target" }) });

  // Pre-seed 3 claims for this wallet in the last hour.
  const nowIso = new Date().toISOString();
  for (let i = 0; i < 3; i++) {
    fake.claims.push({
      id: `seed-${i}`,
      bounty_id: `seed-bounty-${i}`,
      wallet: WALLET,
      trade_tx: `seed-sig-${i}`,
      claimed_at: nowIso,
    });
  }

  const result = await claimTrade({
    bountyId: "bounty-target",
    wallet: WALLET,
    source: "manual",
    trade: makeTrade(),
    supabase: asSupabase(fake),
    evaluator: PASS_EVALUATOR,
  });

  assert.equal(result.kind, "rate_limited");
  assert.ok(result.kind === "rate_limited");
  assert.equal(result.claimsInLastHour, 3);
});

test("evaluator fail: bounty conditions not met → kind='evaluator_rejected' with reasons", async () => {
  const fake = new FakeSupabase();
  fake.bounties.set("bounty-1", { ...makeBounty() });

  const result = await claimTrade({
    bountyId: "bounty-1",
    wallet: WALLET,
    source: "manual",
    trade: makeTrade(),
    supabase: asSupabase(fake),
    evaluator: FAIL_EVALUATOR,
  });

  assert.equal(result.kind, "evaluator_rejected");
  assert.ok(result.kind === "evaluator_rejected");
  assert.deepEqual(result.reasons, ["PnL too low: 5% < min 10%"]);

  // Bounty must remain active when evaluator rejects.
  assert.equal(fake.bounties.get("bounty-1")?.status, "active");
  assert.equal(fake.claims.length, 0);
});

test("source='auto' is persisted on both claim row and bounty.claimed_via", async () => {
  const fake = new FakeSupabase();
  fake.bounties.set("bounty-1", { ...makeBounty() });

  const result = await claimTrade({
    bountyId: "bounty-1",
    wallet: WALLET,
    source: "auto",
    trade: makeTrade(),
    supabase: asSupabase(fake),
    evaluator: PASS_EVALUATOR,
  });

  assert.equal(result.kind, "success");
  assert.equal(fake.claims[0].source, "auto");
  assert.equal(fake.bounties.get("bounty-1")?.claimed_via, "auto");
});

test("bounty not found → kind='bounty_not_found'", async () => {
  const fake = new FakeSupabase();
  // No bounty seeded.
  const result = await claimTrade({
    bountyId: "missing",
    wallet: WALLET,
    source: "manual",
    trade: makeTrade(),
    supabase: asSupabase(fake),
    evaluator: PASS_EVALUATOR,
  });
  assert.equal(result.kind, "bounty_not_found");
});

test("missing required arg throws (caller bug, not expected failure)", async () => {
  const fake = new FakeSupabase();
  await assert.rejects(
    () =>
      claimTrade({
        bountyId: "",
        wallet: WALLET,
        source: "manual",
        trade: makeTrade(),
        supabase: asSupabase(fake),
        evaluator: PASS_EVALUATOR,
      }),
    /missing required argument/i,
  );
});

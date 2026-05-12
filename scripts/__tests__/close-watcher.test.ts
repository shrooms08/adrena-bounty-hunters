#!/usr/bin/env tsx
// Tests for src/lib/close-watcher.ts.
//
// We exercise handleEvent() directly with synthesized WS events + injected
// mocks. The ws dependency is a real Node EventEmitter cast as
// AdrenaWsClient — no real WebSocket. Database is FakeSupabase. fetchPosition
// returns the same real mainnet fixture used in trade-from-ws-event tests.
//
// Run: npx tsx --test scripts/__tests__/close-watcher.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import type { AdrenaWsClient, WsClosePositionEvent, WsLiquidateEvent } from "@/lib/adrena-ws";
import { parseApiPosition, type ApiPosition } from "@/lib/adrena-datapi";
import type { BountyRow } from "@/types";
import type { Evaluator } from "@/lib/claim-trade";
import {
  handleEvent,
  start,
  stop,
  type CloseWatcherDeps,
} from "@/lib/close-watcher";

import { FakeSupabase, asSupabase } from "./_fake-supabase";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const WALLET = "BEG3gUbuzgfc8gAoKx3rN1U2bv9EWkseo99QU3w8322A";

function loadDatapiPosition(): ApiPosition {
  const raw = JSON.parse(
    readFileSync(
      resolve(__dirname, "fixtures", "position-108538.json"),
      "utf8",
    ),
  );
  return parseApiPosition(raw);
}

function loadWsClose(): WsClosePositionEvent {
  return JSON.parse(
    readFileSync(
      resolve(__dirname, "fixtures", "ws-close-108538.json"),
      "utf8",
    ),
  ) as WsClosePositionEvent;
}

function makeBounty(overrides: Partial<BountyRow> = {}): BountyRow {
  return {
    id: `bounty-${Math.random().toString(36).slice(2, 8)}`,
    title: "test",
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

const PASS_EVALUATOR: Evaluator = () => ({
  matches: true,
  reasons: ["✓ Status: active"],
});

const FAIL_EVALUATOR: Evaluator = () => ({
  matches: false,
  reasons: ["PnL too low"],
});

interface BuildOpts {
  position?: ApiPosition | null;
  evaluator?: Evaluator;
  bounties?: BountyRow[];
}

function buildDeps(opts: BuildOpts = {}): {
  deps: CloseWatcherDeps;
  fake: FakeSupabase;
  ws: EventEmitter;
} {
  const fake = new FakeSupabase();
  for (const b of opts.bounties ?? []) fake.bounties.set(b.id, { ...b });

  const ws = new EventEmitter();
  const deps: CloseWatcherDeps = {
    ws: ws as unknown as AdrenaWsClient,
    supabase: asSupabase(fake),
    evaluator: opts.evaluator ?? PASS_EVALUATOR,
    fetchPositionByPda: async () => opts.position ?? loadDatapiPosition(),
  };
  return { deps, fake, ws };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test("close event with matching bounty: audit row + claim, audit updated with claim_id", async () => {
  const bounty = makeBounty();
  const { deps, fake } = buildDeps({ bounties: [bounty] });
  const ws = loadWsClose();

  await handleEvent("close", ws, deps);

  // Audit row exists, marked processed=success, claim_id populated.
  const audit = [...fake.recent_closes.values()][0];
  assert.equal(audit.event_kind, "close");
  assert.equal(audit.wallet, WALLET);
  assert.equal(audit.claim_result_kind, "success");
  assert.match(String(audit.claim_id), /^claim-/);
  assert.ok(audit.processed_at);

  // Claim inserted, bounty marked claimed.
  assert.equal(fake.claims.length, 1);
  assert.equal(fake.claims[0].source, "auto");
  assert.equal(fake.bounties.get(bounty.id)?.status, "claimed");
});

test("no matching bounty: audit row inserted with claim_result_kind='no_match', no claim", async () => {
  const { deps, fake } = buildDeps({ bounties: [] });
  await handleEvent("close", loadWsClose(), deps);

  const audit = [...fake.recent_closes.values()][0];
  assert.equal(audit.claim_result_kind, "no_match");
  assert.equal(audit.claim_id, null);
  assert.equal(fake.claims.length, 0);
});

test("multiple matching bounties: highest reward_points wins, others stay active", async () => {
  const low = makeBounty({ id: "low-50", reward_points: 50 });
  const mid = makeBounty({ id: "mid-200", reward_points: 200 });
  const high = makeBounty({ id: "high-1000", reward_points: 1000 });
  const { deps, fake } = buildDeps({ bounties: [low, high, mid] });

  await handleEvent("close", loadWsClose(), deps);

  assert.equal(
    fake.bounties.get("high-1000")?.status,
    "claimed",
    "highest-reward bounty should be claimed",
  );
  assert.equal(fake.bounties.get("mid-200")?.status, "active");
  assert.equal(fake.bounties.get("low-50")?.status, "active");

  assert.equal(fake.claims.length, 1);
  const audit = [...fake.recent_closes.values()][0];
  assert.equal(audit.claim_result_kind, "success");
});

test("composeTradeFromWsEvent skips: audit marked 'skip', no claim attempt", async () => {
  // Force a skip by returning a position with status='open'.
  const open = loadDatapiPosition();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (open as any).status = "open";
  const { deps, fake } = buildDeps({
    position: open,
    bounties: [makeBounty()],
  });

  await handleEvent("close", loadWsClose(), deps);

  const audit = [...fake.recent_closes.values()][0];
  assert.equal(audit.claim_result_kind, "skip");
  assert.equal(audit.claim_id, null);
  assert.equal(fake.claims.length, 0);
});

test("liquidate event runs through pipeline; profit-only bounty rejects via evaluator_rejected", async () => {
  const bounty = makeBounty({
    min_pnl_percent: 1, // requires positive pnl
  });
  const { deps, fake } = buildDeps({
    bounties: [bounty],
    evaluator: FAIL_EVALUATOR, // simulate evaluator rejecting on negative pnl
  });
  // Reuse the WS close fixture; only the kind argument differs for our
  // pipeline (liquidate path).
  const liquidateEvent = loadWsClose() as unknown as WsLiquidateEvent;

  await handleEvent("liquidate", liquidateEvent, deps);

  const audit = [...fake.recent_closes.values()][0];
  assert.equal(audit.event_kind, "liquidate");
  assert.equal(audit.claim_result_kind, "evaluator_rejected");
  assert.equal(fake.claims.length, 0);
  assert.equal(fake.bounties.get(bounty.id)?.status, "active");
});

test("duplicate event (same tx_signature) silently no-ops second time", async () => {
  const bounty = makeBounty();
  const { deps, fake } = buildDeps({ bounties: [bounty] });
  const ws = loadWsClose();

  await handleEvent("close", ws, deps);
  assert.equal(fake.claims.length, 1);
  const auditCountAfter1 = fake.recent_closes.size;

  // Replay — bounty is already claimed but THAT shouldn't matter; the
  // duplicate-signature check at the recent_closes UNIQUE index short-
  // circuits before claim-trade is even invoked.
  await handleEvent("close", ws, deps);
  assert.equal(fake.claims.length, 1, "must not insert a second claim");
  assert.equal(
    fake.recent_closes.size,
    auditCountAfter1,
    "must not insert a second audit row",
  );
});

test("DB error during step 1 (recent_closes insert) is loud and throws", async () => {
  const { deps, fake } = buildDeps({ bounties: [makeBounty()] });
  fake.errorOn = (table, op) =>
    table === "recent_closes" && op === "insert"
      ? { message: "simulated outage" }
      : null;

  await assert.rejects(
    () => handleEvent("close", loadWsClose(), deps),
    /recent_closes insert failed: simulated outage/,
  );
  assert.equal(fake.claims.length, 0);
});

test("DB error during step 5 (audit update) is logged but does NOT throw, claim already in place", async () => {
  const bounty = makeBounty();
  const { deps, fake } = buildDeps({ bounties: [bounty] });

  // Wait until after step 4 succeeded before injecting the update error.
  // We do this by hooking errorOn to fire only on recent_closes.update.
  fake.errorOn = (table, op) =>
    table === "recent_closes" && op === "update"
      ? { message: "simulated update outage" }
      : null;

  // Should NOT throw.
  await handleEvent("close", loadWsClose(), deps);

  assert.equal(fake.claims.length, 1, "claim still inserted");
  assert.equal(fake.bounties.get(bounty.id)?.status, "claimed");
  // Audit row exists but didn't get its processed_at set.
  const audit = [...fake.recent_closes.values()][0];
  assert.equal(audit.processed_at, undefined);
});

test("WS gap_warning is logged; start()/stop() attaches and detaches handlers", async () => {
  const { deps, ws } = buildDeps();
  start(deps);

  // Capture log output (just exercising the handler registration).
  const origWarn = console.warn;
  const logs: string[] = [];
  console.warn = (...args: unknown[]) => {
    logs.push(args.join(" "));
  };

  try {
    ws.emit("gap_warning", { downtimeMs: 12345, consecutiveFailures: 5 });
    assert.match(logs.join("\n"), /gap_warning downtime=12345ms failures=5/);
  } finally {
    console.warn = origWarn;
  }

  // After stop(), emitting should have no effect (we don't have an easy
  // assertion here other than: re-emit, ensure no log).
  stop(); // detaches all handlers
  logs.length = 0;
  console.warn = (...args: unknown[]) => logs.push(args.join(" "));
  try {
    ws.emit("gap_warning", { downtimeMs: 1, consecutiveFailures: 1 });
    assert.equal(logs.length, 0, "stop() should detach handlers");
  } finally {
    console.warn = origWarn;
  }
});

test("start() is idempotent; calling twice attaches exactly one listener per event", async () => {
  const { deps, ws } = buildDeps();
  start(deps);
  start(deps); // second call should be a no-op

  assert.equal(
    ws.listenerCount("close_position"),
    1,
    "close_position must have exactly one listener",
  );
  assert.equal(ws.listenerCount("liquidate"), 1);
  assert.equal(ws.listenerCount("gap_warning"), 1);

  stop();
  assert.equal(
    ws.listenerCount("close_position"),
    0,
    "stop() must detach all handlers",
  );
});

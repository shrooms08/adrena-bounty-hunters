#!/usr/bin/env tsx
// Unit tests for src/lib/trade-from-api.ts.
//
// Fixtures are real /v4/position rows pulled from datapi (BEG3gUbu trader,
// who happens to have JitoSOL longs/shorts and WBTC longs in their close
// history — exactly the asset coverage we need).
//
// Run: npx tsx --test scripts/__tests__/trade-from-api.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Decimal } from "decimal.js";

import { parseApiPosition, type ApiPosition } from "@/lib/adrena-datapi";
import { apiPositionToTradeEvent } from "@/lib/trade-from-api";

function loadFixture(name: string): ApiPosition {
  const path = resolve(__dirname, "fixtures", name);
  const raw = JSON.parse(readFileSync(path, "utf8"));
  return parseApiPosition(raw);
}

const ARGS = {
  wallet: "BEG3gUbuzgfc8gAoKx3rN1U2bv9EWkseo99QU3w8322A",
  signature: "test-signature-base58",
};

test("SOL long with profit (JitoSOL → SOL, direction=LONG, positive pnl_percent)", () => {
  // pid 108538 — JitoSOL long, entry_lev=10.143, entry_coll=$19.851716, pnl=$2.262936
  const pos = loadFixture("position-108538.json");
  const result = apiPositionToTradeEvent(pos, ARGS);

  assert.equal(result.kind, "close");
  assert.ok(result.kind === "close");
  const e = result.event;

  assert.equal(e.asset, "SOL", "JitoSOL must map to SOL");
  assert.equal(e.direction, "LONG");
  assert.equal(e.wallet, ARGS.wallet);
  assert.equal(e.tx_signature, ARGS.signature);

  // Entry leverage preserved exactly — bounties check what they OPENED with.
  assert.equal(e.leverage, 10.143);

  // Numerics from fixture.
  assert.equal(e.entry_price, 114.09356475);
  assert.equal(e.exit_price, 115.55468092);
  assert.equal(e.position_size_usd, 198.517164);
  assert.equal(e.pnl_usd, 2.262936);

  // PnL% = pnl / entry_collateral_amount * 100 = 2.262936 / 19.851716 * 100
  const expected = new Decimal(2.262936).div(19.851716).mul(100).toNumber();
  assert.equal(e.pnl_percent, expected);
  assert.ok(e.pnl_percent > 0, "profitable trade must have positive pnl_percent");
  assert.ok(
    Math.abs(e.pnl_percent - 11.4) < 0.5,
    `expected ~11.4%, got ${e.pnl_percent}`,
  );

  // Duration: 1067 seconds = 17.78 minutes
  assert.equal(e.duration_minutes, 1067 / 60);

  // Timestamps are unix seconds, derived from ISO dates.
  assert.equal(e.open_timestamp, Math.floor(Date.parse("2026-03-04T14:15:19.000Z") / 1000));
  assert.equal(e.close_timestamp, Math.floor(Date.parse("2026-03-04T14:33:06.000Z") / 1000));
});

test("SOL short with profit (direction=SHORT)", () => {
  // pid 107356 — JitoSOL short. Note: this trade had positive pnl, but the
  // direction mapping is what we care about; sign of pnl_percent is correct
  // either way.
  const pos = loadFixture("position-107356.json");
  const result = apiPositionToTradeEvent(pos, ARGS);

  assert.equal(result.kind, "close");
  assert.ok(result.kind === "close");
  const e = result.event;

  assert.equal(e.asset, "SOL");
  assert.equal(e.direction, "SHORT", "side='short' must map to direction='SHORT'");
  assert.equal(e.leverage, 10.142, "entry_leverage preserved exactly from fixture");
});

test("SOL long with loss (negative pnl_percent)", () => {
  // pid 104999 — JitoSOL long, pnl=-$0.0594, entry_coll=$9.945
  const pos = loadFixture("position-104999.json");
  const result = apiPositionToTradeEvent(pos, ARGS);

  assert.equal(result.kind, "close");
  assert.ok(result.kind === "close");
  const e = result.event;

  assert.equal(e.direction, "LONG");
  assert.ok(e.pnl_usd < 0, "loss must have negative pnl_usd");
  assert.ok(e.pnl_percent < 0, "loss must have negative pnl_percent");
});

test("PnL% denominator is entry_collateral_amount, not live collateral_amount (anti-exploit)", () => {
  // Take a real fixture and mutate it so live collateral != entry collateral.
  // If our mapper used live `collateral_amount` (=$2.00) the percent would
  // be 50/2*100 = 2500%. Using `entry_collateral_amount` (=$100) → 50%.
  const raw = JSON.parse(
    readFileSync(
      resolve(__dirname, "fixtures", "position-108538.json"),
      "utf8",
    ),
  );
  raw.entry_collateral_amount = 100;
  raw.entry_collateral_amount_native = 100;
  raw.collateral_amount = 2; // trader removed $98 of collateral mid-trade
  raw.collateral_amount_native = 2;
  raw.close_collateral_amount = 2;
  raw.pnl = 50;

  const pos = parseApiPosition(raw);
  const result = apiPositionToTradeEvent(pos, ARGS);

  assert.equal(result.kind, "close");
  assert.ok(result.kind === "close");

  assert.equal(
    result.event.pnl_percent,
    50,
    "denominator MUST be entry_collateral_amount; got pnl_percent that suggests live collateral was used",
  );
});

test("liquidate row maps to kind='liquidate'", () => {
  // Synthesize a liquidate row from a real one — flip status + zero out
  // exit_fees etc. to mirror the real liquidate shape per docs.
  const raw = JSON.parse(
    readFileSync(
      resolve(__dirname, "fixtures", "position-104999.json"),
      "utf8",
    ),
  );
  raw.status = "liquidate";
  // Liquidations always lose all collateral; ensure pnl is negative.
  raw.pnl = -raw.entry_collateral_amount;

  const pos = parseApiPosition(raw);
  const result = apiPositionToTradeEvent(pos, ARGS);

  assert.equal(result.kind, "liquidate");
  assert.ok(result.kind === "liquidate");
  assert.ok(result.event.pnl_percent <= -100 + 1e-9, "liquidation should be ≤-100% pnl");
});

test("status='open' is skipped", () => {
  const raw = JSON.parse(
    readFileSync(
      resolve(__dirname, "fixtures", "position-108538.json"),
      "utf8",
    ),
  );
  raw.status = "open";
  raw.exit_price = null;
  raw.exit_date = null;
  raw.pnl = null;

  const pos = parseApiPosition(raw);
  const result = apiPositionToTradeEvent(pos, ARGS);

  assert.equal(result.kind, "skip");
});

test("unsupported symbol is skipped", () => {
  const raw = JSON.parse(
    readFileSync(
      resolve(__dirname, "fixtures", "position-108538.json"),
      "utf8",
    ),
  );
  raw.symbol = "DOGE";

  const pos = parseApiPosition(raw);
  const result = apiPositionToTradeEvent(pos, ARGS);

  assert.equal(result.kind, "skip");
  assert.ok(result.kind === "skip");
  assert.match(result.reason, /unsupported symbol/i);
});

test("WBTC normalizes to BTC", () => {
  const raw = JSON.parse(
    readFileSync(
      resolve(__dirname, "fixtures", "position-108538.json"),
      "utf8",
    ),
  );
  raw.symbol = "WBTC";

  const pos = parseApiPosition(raw);
  const result = apiPositionToTradeEvent(pos, ARGS);

  assert.equal(result.kind, "close");
  assert.ok(result.kind === "close");
  assert.equal(result.event.asset, "BTC");
});

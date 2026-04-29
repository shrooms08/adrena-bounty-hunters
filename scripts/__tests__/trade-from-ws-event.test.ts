#!/usr/bin/env tsx
// Unit tests for src/lib/trade-from-ws-event.ts.
//
// Strategy: synthesize a realistic WS close_position event whose decoded
// PDA + owner match a real datapi position fixture (BEG3gUbu's pid 108538).
// fetchPosition is a mock — we control what it returns to exercise the
// success path, the miss path, and the defensive pubkey-mismatch path.
//
// Run: npx tsx --test scripts/__tests__/trade-from-ws-event.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { parseApiPosition } from "@/lib/adrena-datapi";
import type {
  WsClosePositionEvent,
  WsLiquidateEvent,
} from "@/lib/adrena-ws";
import {
  base64SigToBase58,
  composeTradeFromWsEvent,
  type FetchPositionByPda,
} from "@/lib/trade-from-ws-event";

function loadDatapiFixture(name: string) {
  const path = resolve(__dirname, "fixtures", name);
  return parseApiPosition(JSON.parse(readFileSync(path, "utf8")));
}

function loadWsCloseFixture(): WsClosePositionEvent {
  const path = resolve(__dirname, "fixtures", "ws-close-108538.json");
  return JSON.parse(readFileSync(path, "utf8")) as WsClosePositionEvent;
}

const KNOWN_SIG_BASE58 =
  "PMsbdSgyvrr7He3wiixvKH85YgW5PNnucjrtSzPNXW5oZZJztbxoCyn9qnfNsymihXLJc2YJdcx9Hoqs7nCKEvG";

const KNOWN_SIG_BASE64 =
  "E0hE7F1osA+Nq1UrISzSYoNs1j9tOH1d6MLX1nDLwzkovr2yTRZ/EvaMq4//rJJ8ezX+BZEn3nuQvZfL+OHJBQ==";

test("base64SigToBase58 round-trips a real Solana signature", () => {
  const decoded = base64SigToBase58(KNOWN_SIG_BASE64);
  assert.equal(
    decoded,
    KNOWN_SIG_BASE58,
    "base64 → base58 must produce the canonical explorer signature",
  );
});

test("real WS close + matching datapi row → kind='close', composed via trade-from-api", async () => {
  const ws = loadWsCloseFixture();
  const datapiRow = loadDatapiFixture("position-108538.json");

  const fetchPosition: FetchPositionByPda = async (wallet, pda) => {
    assert.equal(wallet, ws.decoded.owner);
    assert.equal(pda, ws.decoded.position);
    return datapiRow;
  };

  const result = await composeTradeFromWsEvent({
    kind: "close",
    event: ws,
    fetchPosition,
  });

  assert.equal(result.kind, "close");
  assert.ok(result.kind === "close");
  const e = result.event;

  // Mapper authority — same fields as trade-from-api.test.ts assertions.
  assert.equal(e.wallet, ws.decoded.owner);
  assert.equal(e.asset, "SOL"); // JitoSOL → SOL
  assert.equal(e.direction, "LONG");
  assert.equal(e.leverage, 10.143);
  assert.equal(e.position_size_usd, 198.517164);
  assert.equal(e.pnl_usd, 2.262936);
  assert.ok(e.pnl_percent > 0 && e.pnl_percent < 20);

  // Signature is base58, derived from the WS raw base64.
  assert.equal(e.tx_signature, KNOWN_SIG_BASE58);
});

test("WS liquidate + datapi row marked 'close' → kind='liquidate' (override applied)", async () => {
  const ws = loadWsCloseFixture();
  // Mutate to look like a liquidate event payload (the type stays union-
  // compatible — we drop profit_usd in real liquidates, but the close
  // shape is a superset).
  const wsLiquidate = ws as unknown as WsLiquidateEvent;

  const datapiRow = loadDatapiFixture("position-108538.json");
  // datapi still says status='close' — indexer hasn't reconciled yet.
  assert.equal(datapiRow.status, "close");

  const result = await composeTradeFromWsEvent({
    kind: "liquidate",
    event: wsLiquidate,
    fetchPosition: async () => datapiRow,
  });

  assert.equal(
    result.kind,
    "liquidate",
    "WS instruction tag is authoritative over the datapi row's status",
  );
});

test("fetchPosition returns null → kind='skip' with reason naming the PDA", async () => {
  const ws = loadWsCloseFixture();

  const result = await composeTradeFromWsEvent({
    kind: "close",
    event: ws,
    fetchPosition: async () => null,
  });

  assert.equal(result.kind, "skip");
  assert.ok(result.kind === "skip");
  assert.match(
    result.reason,
    new RegExp(ws.decoded.position),
    "skip reason should mention the missing position PDA",
  );
});

test("fetchPosition returns row with mismatched pubkey → kind='skip' (defensive)", async () => {
  const ws = loadWsCloseFixture();
  const datapiRow = loadDatapiFixture("position-108538.json");
  // Mutate the row to simulate a contract-violating fetcher.
  const wrongPdaRow = { ...datapiRow, pubkey: "WRONG1111111111111111111111111111111111111" };

  const result = await composeTradeFromWsEvent({
    kind: "close",
    event: ws,
    fetchPosition: async () => wrongPdaRow,
  });

  assert.equal(result.kind, "skip");
  assert.ok(result.kind === "skip");
  assert.match(result.reason, /pubkey mismatch/i);
});

test("fetchPosition throws → kind='skip' with the underlying error message (no crash)", async () => {
  const ws = loadWsCloseFixture();

  const result = await composeTradeFromWsEvent({
    kind: "close",
    event: ws,
    fetchPosition: async () => {
      throw new Error("simulated 503");
    },
  });

  assert.equal(result.kind, "skip");
  assert.ok(result.kind === "skip");
  assert.match(result.reason, /simulated 503/);
});

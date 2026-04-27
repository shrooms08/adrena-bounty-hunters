#!/usr/bin/env tsx
import { readFileSync } from "node:fs";
import { Connection } from "@solana/web3.js";
import type { Bounty } from "@/types";
import { evaluateTrade } from "@/lib/bounty-evaluator";
import { fetchTxEvents, findOpenForCloseEvent } from "../parsers/tx-parser";
import { composeTradeEvent } from "../parsers/trade-composer";

const HELP = `
test-evaluate — full parse → evaluate pipeline against a mock bounty

USAGE
  npx tsx scripts/cli/test-evaluate.ts <signature> <bounty.json>

ENV
  NEXT_PUBLIC_SOLANA_RPC   RPC endpoint (default: mainnet-beta)

DESCRIPTION
  Parses the given close transaction (same logic as parse-close-tx),
  then feeds the composed AdrenaTradeEvent into the evaluator against
  the bounty loaded from <bounty.json>. Prints evaluator result with
  all pass/fail reasons.

BOUNTY JSON SHAPE (minimum fields)
  {
    "id": "test",
    "title": "Test bounty",
    "description": "...",
    "asset": "SOL",
    "direction": "LONG" | "SHORT" | null,
    "min_pnl_percent": number | null,
    "max_pnl_percent": number | null,
    "min_leverage": number | null,
    "max_leverage": number | null,
    "max_duration_minutes": number | null,
    "min_position_size_usd": 50,
    "tier": "common" | "rare" | "legendary",
    "reward_points": 50,
    "status": "active",
    "claimed_by": null,
    "claimed_at": null,
    "claimed_trade_tx": null,
    "created_at": "2026-01-01T00:00:00Z",
    "expires_at": "2030-01-01T00:00:00Z"
  }

EXIT CODES
  0  evaluator returned matches: true
  1  evaluator returned matches: false, OR parse/compose failed
`.trim();

function fail(msg: string): never {
  console.error(`test-evaluate: ${msg}`);
  process.exit(1);
}

function loadBounty(path: string): Bounty {
  let raw: string;
  try {
    raw = readFileSync(path, "utf8");
  } catch (err) {
    fail(
      `could not read bounty file ${path}: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
  try {
    return JSON.parse(raw) as Bounty;
  } catch (err) {
    fail(
      `bounty file is not valid JSON: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.length === 0 || args.includes("-h") || args.includes("--help")) {
    console.log(HELP);
    process.exit(args.length === 0 ? 1 : 0);
  }

  const [signature, bountyPath] = args;
  if (!signature || !bountyPath) {
    fail("missing arguments: <signature> <bounty.json> (try --help)");
  }

  const bounty = loadBounty(bountyPath);

  const rpcUrl =
    process.env.NEXT_PUBLIC_SOLANA_RPC ?? "https://api.mainnet-beta.solana.com";
  const connection = new Connection(rpcUrl, "confirmed");

  const closeTx = await fetchTxEvents(connection, signature);
  if (!closeTx) fail(`transaction not found: ${signature}`);
  if (closeTx.blockTime === null) fail("transaction has no blockTime");
  if (!closeTx.close) fail("no ClosePositionEvent in transaction");

  const openMatch = await findOpenForCloseEvent(
    connection,
    closeTx.close,
    closeTx.blockTime,
  );

  const compose = composeTradeEvent({
    close: closeTx.close,
    closeBlockTime: closeTx.blockTime,
    closeSignature: signature,
    open: openMatch
      ? { event: openMatch.open, blockTime: openMatch.tx.blockTime ?? 0 }
      : null,
  });

  if (compose.status !== "complete") {
    fail(
      `compose failed (${compose.status}): ${"reason" in compose ? compose.reason : "open_missing"}`,
    );
  }

  const result = evaluateTrade(bounty, compose.event);

  console.log(
    JSON.stringify(
      {
        bounty: {
          id: bounty.id,
          title: bounty.title,
          tier: bounty.tier,
          asset: bounty.asset,
          direction: bounty.direction,
        },
        trade: compose.event,
        evaluation: result,
      },
      null,
      2,
    ),
  );

  process.exit(result.matches ? 0 : 1);
}

main().catch((err) => {
  console.error(
    `test-evaluate: unhandled error — ${err instanceof Error ? err.stack ?? err.message : String(err)}`,
  );
  process.exit(1);
});

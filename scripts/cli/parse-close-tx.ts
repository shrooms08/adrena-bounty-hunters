#!/usr/bin/env tsx
import { Connection } from "@solana/web3.js";
import { fetchTxEvents, findOpenForCloseEvent } from "../parsers/tx-parser";
import { composeTradeEvent } from "../parsers/trade-composer";

const HELP = `
parse-close-tx — decode an Adrena close_position transaction

USAGE
  npx tsx scripts/cli/parse-close-tx.ts <signature>

ENV
  NEXT_PUBLIC_SOLANA_RPC   RPC endpoint (default: mainnet-beta)

DESCRIPTION
  Fetches the given Solana transaction signature, decodes its
  ClosePositionEvent, walks the owner's history to find the matching
  OpenPositionEvent, composes an AdrenaTradeEvent, and prints it as
  formatted JSON.

EXIT CODES
  0  success — AdrenaTradeEvent printed to stdout
  1  failure — reason printed to stderr
`.trim();

function fail(msg: string): never {
  console.error(`parse-close-tx: ${msg}`);
  process.exit(1);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.length === 0 || args.includes("-h") || args.includes("--help")) {
    console.log(HELP);
    process.exit(args.length === 0 ? 1 : 0);
  }

  const signature = args[0];
  if (!signature || signature.startsWith("-")) {
    fail("missing <signature> argument (try --help)");
  }

  const rpcUrl =
    process.env.NEXT_PUBLIC_SOLANA_RPC ?? "https://api.mainnet-beta.solana.com";
  const connection = new Connection(rpcUrl, "confirmed");

  const closeTx = await fetchTxEvents(connection, signature);
  if (!closeTx) fail(`transaction not found: ${signature}`);
  if (closeTx.blockTime === null)
    fail("transaction has no blockTime (unconfirmed?)");
  if (!closeTx.close)
    fail(
      `no ClosePositionEvent in transaction. Found events: [${closeTx.events.map((e) => e.name).join(", ") || "none"}]`,
    );

  const close = closeTx.close;
  const closeBlockTime = closeTx.blockTime;

  console.error(
    `[parse-close-tx] found close: owner=${close.owner.toBase58()} positionId=${close.positionId.toString()} — searching for matching open…`,
  );

  const openMatch = await findOpenForCloseEvent(
    connection,
    close,
    closeBlockTime,
  );
  const openContext = openMatch
    ? { event: openMatch.open, blockTime: openMatch.tx.blockTime ?? 0 }
    : null;

  if (!openMatch) {
    console.error(
      "[parse-close-tx] no matching OpenPositionEvent found in last 200 signatures",
    );
  } else {
    console.error(
      `[parse-close-tx] matched open tx ${openMatch.tx.signature} @ blockTime=${openMatch.tx.blockTime}`,
    );
  }

  const result = composeTradeEvent({
    close,
    closeBlockTime,
    closeSignature: signature,
    open: openContext,
  });

  if (result.status === "complete") {
    console.log(JSON.stringify(result.event, null, 2));
    process.exit(0);
  }

  if (result.status === "open_missing") {
    fail(
      `compose failed (open_missing): positionId=${result.positionId} owner=${result.owner}`,
    );
  }

  // invalid
  fail(
    `compose failed (invalid): ${result.reason} — positionId=${result.positionId} owner=${result.owner}`,
  );
}

main().catch((err) => {
  console.error(
    `parse-close-tx: unhandled error — ${err instanceof Error ? err.stack ?? err.message : String(err)}`,
  );
  process.exit(1);
});

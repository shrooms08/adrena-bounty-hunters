#!/usr/bin/env tsx
// Temp dev tool: scan last N Adrena program signatures, collect the first K
// that contain a ClosePositionEvent. Env: SCOUT_WANT (default 1),
// SCOUT_DELAY_MS (default 600).
import { Connection, PublicKey } from "@solana/web3.js";
import { ADRENA_PROGRAM_ID } from "../constants/adrena";
import { fetchTxEvents } from "../parsers/tx-parser";

async function main() {
  const limit = Number(process.argv[2] ?? 50);
  const want = Number(process.env.SCOUT_WANT ?? 1);
  const rpcUrl =
    process.env.NEXT_PUBLIC_SOLANA_RPC ?? "https://api.mainnet-beta.solana.com";
  const connection = new Connection(rpcUrl, "confirmed");

  console.error(
    `[scout] scanning last ${limit} sigs of ${ADRENA_PROGRAM_ID} (rpc=${rpcUrl}) want=${want}`,
  );
  // Walk multiple pages until we have `limit` sigs, starting from SCOUT_BEFORE.
  const sigs: Awaited<ReturnType<Connection["getSignaturesForAddress"]>> = [];
  let cursor = process.env.SCOUT_BEFORE;
  while (sigs.length < limit) {
    const page = await connection.getSignaturesForAddress(
      new PublicKey(ADRENA_PROGRAM_ID),
      { limit: Math.min(1000, limit - sigs.length), before: cursor },
    );
    if (page.length === 0) break;
    sigs.push(...page);
    cursor = page[page.length - 1].signature;
  }
  console.error(`[scout] fetched ${sigs.length} signatures`);

  const perTxDelayMs = Number(process.env.SCOUT_DELAY_MS ?? 600);
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  const hits: string[] = [];
  let checked = 0;
  for (const s of sigs) {
    if (hits.length >= want) break;
    checked++;
    await sleep(perTxDelayMs);
    const result = await fetchTxEvents(connection, s.signature);
    if (!result?.close) continue;
    console.error(
      `[scout] hit ${hits.length + 1}/${want} after ${checked} checks: ${s.signature}`,
    );
    hits.push(s.signature);
  }

  if (hits.length === 0) {
    console.error(`[scout] no ClosePositionEvent in last ${checked} sigs`);
    process.exit(2);
  }
  console.log(hits.join("\n"));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

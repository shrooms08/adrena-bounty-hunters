#!/usr/bin/env tsx
// Smoke test for src/lib/adrena-datapi.ts.
//
// Hits fetchPositions and fetchTraderInfo for a known active mainnet trader
// (4C9smec…oayPx — the wallet used as the docs example, confirmed live with
// 198 historical positions). Prints summary stats, exits 1 on any error.

import {
  fetchPositions,
  fetchTraderInfo,
  AdrenaDatapiError,
} from "@/lib/adrena-datapi";

const WALLET = "4C9smecZcqEvALzmmgWsDd9w3JHPdVZAEUW86V3oayPx";

async function main(): Promise<void> {
  console.log(`[smoke] wallet=${WALLET}`);
  console.log(`[smoke] base=${process.env.ADRENA_DATAPI_BASE_URL ?? "https://datapi.adrena.trade"}`);

  console.log("\n[smoke] fetchPositions(status=close, limit=10, sort=DESC)");
  const positions = await fetchPositions(WALLET, {
    status: ["close"],
    limit: 10,
    sortField: "exit_date",
    sort: "DESC",
  });
  console.log(`  positions returned : ${positions.positions.length}`);
  console.log(`  total_count        : ${positions.total_count}`);
  console.log(`  pool_name          : ${positions.pool_name ?? "(none)"}`);

  if (positions.positions.length === 0) {
    throw new Error("expected at least one position for this wallet");
  }
  const newest = positions.positions[0];
  console.log("\n[smoke] newest closed position:");
  console.log(`  id=${newest.position_id} sym=${newest.symbol} side=${newest.side}`);
  console.log(`  entry=${newest.entry_price.toFixed(8)} exit=${newest.exit_price?.toFixed(8) ?? "null"}`);
  console.log(`  size=$${newest.entry_size.toFixed(2)} pnl=$${newest.pnl?.toFixed(4) ?? "null"} lev=${newest.entry_leverage.toFixed(2)}x`);
  console.log(`  entry_date=${newest.entry_date} exit_date=${newest.exit_date}`);
  console.log(`  pubkey=${newest.pubkey}`);

  console.log("\n[smoke] fetchTraderInfo");
  const info = await fetchTraderInfo(WALLET);
  console.log(`  user_pubkey         : ${info.user_pubkey}`);
  console.log(`  total_volume        : $${info.total_volume.toFixed(2)}`);
  console.log(`  total_pnl           : $${info.total_pnl.toFixed(2)}`);
  console.log(`  win_rate_percentage : ${info.win_rate_percentage.toFixed(2)}%`);
  console.log(`  positions (closed)  : ${info.total_number_positions_closed}`);
  console.log(`  positions (liquid)  : ${info.total_number_positions_liquidated}`);
  console.log(`  positions (open)    : ${info.total_number_positions_open}`);
  console.log(`  avg_holding_time    : ${info.avg_holding_time.toFixed(0)}s`);

  console.log("\n[smoke] OK");
}

main().catch((err) => {
  if (err instanceof AdrenaDatapiError) {
    console.error(`[smoke] FAIL: AdrenaDatapiError ${err.endpoint} → ${err.status} (${err.message})`);
  } else {
    console.error(`[smoke] FAIL: ${err instanceof Error ? err.stack ?? err.message : String(err)}`);
  }
  process.exit(1);
});

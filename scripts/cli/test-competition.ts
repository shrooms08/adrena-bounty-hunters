#!/usr/bin/env tsx
// Smoke test for src/lib/adrena-competition.ts.
//
// Hits healthCheck, fetchSizeMultiplierTable, and calculateSizeMultiplier
// against the gated competition service. The expected multiplier for
// size=75000 is 7 per ROUTES.md §size-multiplier/calculate sample.

import { config } from "dotenv";
import { resolve } from "node:path";

// Next.js loads .env.local automatically in app code, but tsx scripts don't.
config({ path: resolve(process.cwd(), ".env.local") });

import {
  healthCheck,
  fetchSizeMultiplierTable,
  calculateSizeMultiplier,
  AdrenaCompetitionError,
} from "@/lib/adrena-competition";

async function main(): Promise<void> {
  console.log(`[smoke] base=${process.env.ADRENA_COMPETITION_BASE_URL}`);
  console.log(`[smoke] api key set: ${process.env.ADRENA_COMPETITION_API_KEY ? "yes" : "NO"}`);

  console.log("\n[smoke] healthCheck");
  const health = await healthCheck();
  if (health.status !== "ok") throw new Error(`unexpected health status: ${health.status}`);
  if (!health.timestamp || health.timestamp < 1_000_000_000_000) {
    throw new Error(`unexpected timestamp: ${health.timestamp}`);
  }
  console.log(`  status=${health.status} timestamp=${health.timestamp} (${new Date(health.timestamp).toISOString()})`);

  console.log("\n[smoke] fetchSizeMultiplierTable");
  const table = await fetchSizeMultiplierTable();
  if (table.tiers.length === 0) throw new Error("table has no tiers");
  const first = table.tiers[0];
  const last = table.tiers[table.tiers.length - 1];
  console.log(`  tier count : ${table.tiers.length}`);
  console.log(`  first      : $${first.minSize}–$${first.maxSize} → ${first.multiplierMin}×–${first.multiplierMax}×`);
  console.log(`  last       : $${last.minSize}–$${last.maxSize} → ${last.multiplierMin}×–${last.multiplierMax}×`);
  console.log(`  interp     : ${table.interpolation}`);

  console.log("\n[smoke] calculateSizeMultiplier(size=75000)");
  const result = await calculateSizeMultiplier(75_000);
  console.log(`  sizeUsd    : $${result.sizeUsd.toFixed(2)}`);
  console.log(`  multiplier : ${result.multiplier.toFixed(4)}×`);
  console.log(`  tier       : ${result.tier ? `$${result.tier.minSize}–$${result.tier.maxSize}` : "null"}`);
  if (!result.multiplier.equals(7)) {
    throw new Error(`expected multiplier=7 for size=75000, got ${result.multiplier.toFixed()}`);
  }

  console.log("\n[smoke] OK");
}

main().catch((err) => {
  if (err instanceof AdrenaCompetitionError) {
    console.error(
      `[smoke] FAIL: AdrenaCompetitionError ${err.endpoint} → ${err.status} (${err.message})`,
    );
  } else {
    console.error(`[smoke] FAIL: ${err instanceof Error ? err.stack ?? err.message : String(err)}`);
  }
  process.exit(1);
});

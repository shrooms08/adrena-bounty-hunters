#!/usr/bin/env tsx
// Smoke test for src/lib/adrena-ws.ts.
//
// Connects to the Adrena competition relay, prints every event with
// timestamps for N seconds (default 60), pretty-prints close_position and
// liquidate events, then disconnects cleanly. Exits 0 on a clean shutdown,
// 1 on any unhandled error.

import { config } from "dotenv";
import { resolve } from "node:path";
config({ path: resolve(process.cwd(), ".env.local") });

import {
  connect,
  disconnect,
  getAdrenaWsClient,
} from "@/lib/adrena-ws";

const DURATION_S = Number(process.argv[2] ?? 60);
const DURATION_MS = DURATION_S * 1_000;

interface Counts {
  info: number;
  position_account: number;
  close_position: number;
  liquidate: number;
  ping: number;
  ping_no_upstream: number;
  connected: number;
  disconnected: number;
  reconnecting: number;
  degraded: number;
  gap_warning: number;
}

const counts: Counts = {
  info: 0,
  position_account: 0,
  close_position: 0,
  liquidate: 0,
  ping: 0,
  ping_no_upstream: 0,
  connected: 0,
  disconnected: 0,
  reconnecting: 0,
  degraded: 0,
  gap_warning: 0,
};

function ts(): string {
  return new Date().toISOString().slice(11, 23);
}

function formatUsdScaled(raw: string): string {
  // u64 USD fields are scaled by 1e6 per ROUTES.md.
  try {
    return `$${(Number(BigInt(raw)) / 1_000_000).toFixed(4)}`;
  } catch {
    return raw;
  }
}

function sideName(side: number): string {
  return side === 1 ? "LONG" : side === 2 ? "SHORT" : `side=${side}`;
}

async function main(): Promise<void> {
  console.log(`[smoke] duration=${DURATION_S}s`);
  console.log(
    `[smoke] base=${process.env.ADRENA_COMPETITION_WS_URL ?? "wss://adrena-competition-service.onrender.com"}`,
  );

  const client = getAdrenaWsClient();

  client.on("info", (payload) => {
    counts.info += 1;
    console.log(
      `[${ts()}] info programId=${payload.programId} types=${Object.keys(payload.messageTypes).join(",")}`,
    );
  });

  client.on("connected", () => {
    counts.connected += 1;
    console.log(`[${ts()}] connected (state=${client.getState()})`);
  });

  client.on("disconnected", ({ code, reason }) => {
    counts.disconnected += 1;
    console.log(`[${ts()}] disconnected code=${code} reason="${reason}"`);
  });

  client.on("reconnecting", ({ attempt, delayMs }) => {
    counts.reconnecting += 1;
    console.log(`[${ts()}] reconnecting attempt=${attempt} delay=${delayMs}ms`);
  });

  client.on("degraded", () => {
    counts.degraded += 1;
    console.log(`[${ts()}] degraded (no_upstream)`);
  });

  client.on("gap_warning", ({ downtimeMs, consecutiveFailures }) => {
    counts.gap_warning += 1;
    console.log(
      `[${ts()}] GAP WARNING downtime=${downtimeMs}ms failures=${consecutiveFailures}`,
    );
  });

  client.on("position_account", (e) => {
    counts.position_account += 1;
    console.log(
      `[${ts()}] position_account pda=${e.raw.pubkey.slice(0, 8)}… owner=${e.decoded.owner.slice(0, 8)}… ${sideName(e.decoded.side)} size=${formatUsdScaled(e.decoded.size_usd)} closed=${e.raw.is_closed}`,
    );
  });

  client.on("close_position", (e) => {
    counts.close_position += 1;
    const d = e.decoded;
    const sigPrefix = e.raw.signature.slice(0, 16);
    const pnl =
      BigInt(d.profit_usd) > BigInt(0)
        ? `profit=${formatUsdScaled(d.profit_usd)}`
        : `loss=${formatUsdScaled(d.loss_usd)}`;
    console.log(
      `[${ts()}] CLOSE  ${sideName(d.side)}  wallet=${d.owner}  size=${formatUsdScaled(d.size_usd)}  ${pnl}  position_id=${d.position_id}  sig=${sigPrefix}…`,
    );
  });

  client.on("liquidate", (e) => {
    counts.liquidate += 1;
    const d = e.decoded;
    const sigPrefix = e.raw.signature.slice(0, 16);
    console.log(
      `[${ts()}] LIQ    ${sideName(d.side)}  wallet=${d.owner}  size=${formatUsdScaled(d.size_usd)}  loss=${formatUsdScaled(d.loss_usd)}  liq_fee=${formatUsdScaled(d.liquidation_fee_usd)}  position_id=${d.position_id}  sig=${sigPrefix}…`,
    );
  });

  client.on("ping", (e) => {
    counts.ping += 1;
    if ("status" in e.data && e.data.status === "no_upstream") {
      counts.ping_no_upstream += 1;
    }
  });

  console.log(`[${ts()}] connecting…`);
  connect();

  await new Promise<void>((resolve) => setTimeout(resolve, DURATION_MS));

  console.log(`[${ts()}] disconnecting…`);
  disconnect();
  // Allow socket close to flush.
  await new Promise<void>((resolve) => setTimeout(resolve, 250));

  console.log("\n[smoke] event counts:");
  for (const [k, v] of Object.entries(counts)) {
    console.log(`  ${k.padEnd(20)} ${v}`);
  }
  console.log(`\n[smoke] final state: ${client.getState()}`);

  if (counts.info === 0) {
    throw new Error("no info message received — handshake failed");
  }
  console.log("[smoke] OK");
}

main().catch((err) => {
  console.error(
    `[smoke] FAIL: ${err instanceof Error ? (err.stack ?? err.message) : String(err)}`,
  );
  try {
    disconnect();
  } catch {
    /* ignore */
  }
  process.exit(1);
});

#!/usr/bin/env tsx
import { Connection } from "@solana/web3.js";
import { fetchTxEvents } from "../parsers/tx-parser";

async function main() {
  const sig = process.argv[2];
  const rpc = process.env.NEXT_PUBLIC_SOLANA_RPC ?? "https://api.mainnet-beta.solana.com";
  const c = new Connection(rpc, "confirmed");
  const r = await fetchTxEvents(c, sig);
  if (!r) return console.log("not found");
  console.log("blockTime:", r.blockTime, "slot:", r.slot);
  console.log("events:", r.events.map((e) => e.name));
  console.log("--- program-data lines ---");
  r.logs
    .filter((l) => l.includes("Program data:"))
    .forEach((l, i) => console.log(`[${i}]`, l));
}
main().catch(console.error);

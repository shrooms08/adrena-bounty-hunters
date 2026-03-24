import { Connection, PublicKey } from "@solana/web3.js";
import type { AdrenaTradeEvent } from "@/types";
import { ADRENA_PROGRAM_ID } from "@/lib/constants";

// Full integration would parse Adrena's close_position instruction data to extract:
// asset, direction, entry/exit price, leverage, P&L. This requires deserializing
// the instruction data using the Adrena IDL from
// github.com/AdrenaFoundation/adrena-abi.
//
// For the prototype, we demonstrate on-chain connectivity and use simulated trade
// events for the claim flow.

/**
 * Fetch recent confirmed transaction signatures for the Adrena program.
 * Proves live on-chain connectivity to real Adrena activity.
 */
export async function getRecentAdrenaTrades(
  connection: Connection,
  limit: number = 20,
) {
  const programKey = new PublicKey(ADRENA_PROGRAM_ID);
  const signatures = await connection.getSignaturesForAddress(programKey, {
    limit,
  });

  return signatures.map((sig) => ({
    signature: sig.signature,
    slot: sig.slot,
    blockTime: sig.blockTime,
    memo: sig.memo,
  }));
}

/**
 * Fetch recent wallet transactions that interact with the Adrena program.
 * Filters the wallet's tx history for Adrena-related activity.
 */
export async function getWalletPositions(
  connection: Connection,
  walletAddress: string,
) {
  const walletKey = new PublicKey(walletAddress);
  const signatures = await connection.getSignaturesForAddress(walletKey, {
    limit: 50,
  });

  const adrenaTxs: typeof signatures = [];

  for (const sig of signatures) {
    const tx = await connection.getTransaction(sig.signature, {
      maxSupportedTransactionVersion: 0,
    });

    if (!tx) continue;

    const accountKeys = tx.transaction.message.getAccountKeys();
    const programId = ADRENA_PROGRAM_ID;

    for (let i = 0; i < accountKeys.length; i++) {
      if (accountKeys.get(i)?.toBase58() === programId) {
        adrenaTxs.push(sig);
        break;
      }
    }
  }

  return adrenaTxs.map((sig) => ({
    signature: sig.signature,
    slot: sig.slot,
    blockTime: sig.blockTime,
    memo: sig.memo,
  }));
}

/**
 * Simulated trade events for demo purposes when full tx parsing isn't available.
 * Returns realistic AdrenaTradeEvent objects for the claim verification flow.
 */
export function simulateTradeCompletion(): AdrenaTradeEvent[] {
  const now = Math.floor(Date.now() / 1000);

  return [
    {
      wallet: "7xKX...demo",
      asset: "SOL",
      direction: "LONG",
      entry_price: 178.42,
      exit_price: 191.44,
      leverage: 25,
      position_size_usd: 500,
      pnl_usd: 36.5,
      pnl_percent: 7.3,
      duration_minutes: 12,
      open_timestamp: now - 720,
      close_timestamp: now,
      tx_signature:
        "5KtPn1LGuxhFiwjxErkxTb3XoEBBeFg2cHYxkRfq7vJNDRMKxHerschelDemo1",
    },
    {
      wallet: "9bQ3...demo",
      asset: "BTC",
      direction: "SHORT",
      entry_price: 68420.0,
      exit_price: 66350.8,
      leverage: 10,
      position_size_usd: 1200,
      pnl_usd: 362.88,
      pnl_percent: 3.02,
      duration_minutes: 27,
      open_timestamp: now - 1620,
      close_timestamp: now,
      tx_signature:
        "3mZvG8hqNpXwD5TkF1RbJcW9AeYuKs4nL7tMxDemo2sig",
    },
    {
      wallet: "4vFe...demo",
      asset: "BONK",
      direction: "LONG",
      entry_price: 0.00002341,
      exit_price: 0.00002594,
      leverage: 50,
      position_size_usd: 200,
      pnl_usd: 108.0,
      pnl_percent: 10.81,
      duration_minutes: 8,
      open_timestamp: now - 480,
      close_timestamp: now,
      tx_signature:
        "2pRkV9sYcNqWjB7xHmTdFe3KaLu8ZgXn5wDemo3sig",
    },
  ];
}

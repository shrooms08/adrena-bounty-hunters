import type { Connection } from "@solana/web3.js";
import {
  decodeEventsFromLogs,
  findCloseEvent,
  findOpenEvent,
  type DecodedAdrenaEvent,
  type DecodedClosePositionEvent,
  type DecodedOpenPositionEvent,
} from "./event-decoder";

export interface TxEvents {
  signature: string;
  blockTime: number | null; // unix seconds, null only for very recent unconfirmed txs
  slot: number;
  logs: string[];
  events: DecodedAdrenaEvent[];
  close: DecodedClosePositionEvent | null;
  open: DecodedOpenPositionEvent | null;
}

export async function fetchTxEvents(
  connection: Connection,
  signature: string,
): Promise<TxEvents | null> {
  const tx = await connection.getTransaction(signature, {
    maxSupportedTransactionVersion: 0,
    commitment: "confirmed",
  });
  if (!tx) return null;

  const logs = tx.meta?.logMessages ?? [];
  const events = decodeEventsFromLogs(logs);

  return {
    signature,
    blockTime: tx.blockTime ?? null,
    slot: tx.slot,
    logs,
    events,
    close: findCloseEvent(events),
    open: findOpenEvent(events),
  };
}

// Given a close tx, walk the owner's prior signatures until we find the tx
// that emitted the OpenPositionEvent with the matching positionId. Used as
// the Option-C fallback when the indexer has no record of the open.
//
// Cost: up to `maxLookback` getSignaturesForAddress pages + N getTransaction
// calls. Intended for cold-start / gap recovery, not the hot path.
export async function findOpenForCloseEvent(
  connection: Connection,
  closeEvent: DecodedClosePositionEvent,
  closeBlockTime: number,
  maxLookback = 200,
): Promise<{ tx: TxEvents; open: DecodedOpenPositionEvent } | null> {
  const owner = closeEvent.owner;
  const targetPositionId = closeEvent.positionId.toString();

  const sigs = await connection.getSignaturesForAddress(owner, {
    limit: maxLookback,
  });

  // Walk oldest-first so we find the original open rather than any partial
  // AddCollateral/RemoveCollateral intermediates (those emit different event
  // types, but filter defensively).
  const older = sigs
    .filter((s) => (s.blockTime ?? Infinity) < closeBlockTime)
    .reverse();

  for (const s of older) {
    const result = await fetchTxEvents(connection, s.signature);
    if (!result?.open) continue;
    if (
      result.open.positionId.toString() === targetPositionId &&
      result.open.owner.equals(owner)
    ) {
      return { tx: result, open: result.open };
    }
  }

  return null;
}

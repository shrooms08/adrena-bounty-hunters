// Pure-ish mapper: a WS close_position / liquidate event → AdrenaTradeEvent.
//
// This is the auto-claim path's analog of trade-from-api.ts. The WS event
// carries `decoded.collateral_amount_usd` (collateral *at close time*) but
// not the entry collateral, which is what the anti-exploit invariant
// requires for the pnl_percent denominator. We resolve by fetching the
// position from datapi (matched by PDA, since the WS event's
// `decoded.position_id` is the on-chain Position::id and datapi indexes by
// its own DB row counter — POSITION.md §40-44).
//
// The fetcher is injected so this file stays pure and testable. The
// close-watcher provides a real implementation that wraps adrena-datapi.

import bs58 from "bs58";

import type { ApiPosition } from "@/lib/adrena-datapi";
import type {
  WsClosePositionEvent,
  WsLiquidateEvent,
} from "@/lib/adrena-ws";
import {
  apiPositionToTradeEvent,
  type TradeFromApiResult,
} from "@/lib/trade-from-api";

export type FetchPositionByPda = (
  wallet: string,
  positionPda: string,
) => Promise<ApiPosition | null>;

export type WsEventKind = "close" | "liquidate";

export interface ComposeFromWsArgs {
  /** WS instruction tag — authoritative for "was this a voluntary close
   *  or a forced liquidation". datapi may mark a freshly-liquidated row
   *  with status='close' during indexer transition; we override using
   *  this. */
  kind: WsEventKind;
  event: WsClosePositionEvent | WsLiquidateEvent;
  fetchPosition: FetchPositionByPda;
}

/**
 * Convert a Solana tx signature from base64 (the WS wire format) to base58
 * (the standard explorer / `/transaction-position` format).
 */
export function base64SigToBase58(base64: string): string {
  return bs58.encode(Buffer.from(base64, "base64"));
}

export async function composeTradeFromWsEvent(
  args: ComposeFromWsArgs,
): Promise<TradeFromApiResult> {
  const { kind, event, fetchPosition } = args;
  const wallet = event.decoded.owner;
  const pda = event.decoded.position;

  let position: ApiPosition | null;
  try {
    position = await fetchPosition(wallet, pda);
  } catch (err) {
    return {
      kind: "skip",
      reason: `fetchPosition threw: ${(err as Error).message}`,
    };
  }

  if (!position) {
    return {
      kind: "skip",
      reason: `position pda ${pda} not found in datapi for wallet ${wallet} (indexing lag?)`,
    };
  }

  // Defensive: fetchPosition is contractually supposed to filter by PDA,
  // but if a future implementation drifts (or Adrena ever ships PDA reuse)
  // we refuse to compose a trade for a row that doesn't match the on-chain
  // event. Better to skip + log than to silently emit the wrong trade.
  if (position.pubkey !== pda) {
    return {
      kind: "skip",
      reason: `pubkey mismatch: ws event references ${pda}, datapi row is ${position.pubkey}`,
    };
  }

  const signature = base64SigToBase58(event.raw.signature);

  const result = apiPositionToTradeEvent(position, { wallet, signature });
  if (result.kind === "skip") return result;

  // WS event tells us this was a forced liquidation; datapi might mark the
  // row 'close' depending on indexer timing — trust the WS instruction tag.
  if (kind === "liquidate" && result.kind === "close") {
    return { kind: "liquidate", event: result.event };
  }
  return result;
}

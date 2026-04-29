// Pure mapper: a /v4/position row from datapi → AdrenaTradeEvent (the
// evaluator's input shape). Documented in docs/POSITION.md.
//
// Anti-exploit invariant (ZeDef flagged this — same logic used in the
// Phase 1 on-chain composer at scripts/parsers/trade-composer.ts:113):
//   pnl_percent denominator is `entry_collateral_amount` (collateral at
//   open), NEVER `collateral_amount` (live). Otherwise a trader can remove
//   collateral mid-trade to inflate the reported pnl_percent on the close
//   side.
//
// Liquidation handling:
//   We return a discriminated union so callers (claim-trade, auto-watcher)
//   can route close vs liquidate without us touching AdrenaTradeEvent's
//   shape. The evaluator stays pure on AdrenaTradeEvent. Manual claims
//   reject `kind === 'liquidate'`; auto-claim's evaluator rejects via the
//   bounty's PnL bands. Liquidations always have negative `pnl` so
//   positive-PnL bounties naturally fail.

import type {
  AdrenaTradeEvent,
  TradeDirection,
  TradingAsset,
} from "@/types";
import type { ApiPosition } from "@/lib/adrena-datapi";

export type TradeFromApiResult =
  | { kind: "close"; event: AdrenaTradeEvent }
  | { kind: "liquidate"; event: AdrenaTradeEvent }
  | { kind: "skip"; reason: string };

export interface TradeFromApiArgs {
  /** Trader wallet (base58). Caller resolves this from /transaction-position
   *  or `decoded.owner` on a WS event. The /v4/position row only carries
   *  user_id and the position PDA, not the wallet. */
  wallet: string;
  /** The close (or liquidation) tx signature, base58. Caller pulls this
   *  from /transaction-position or the WS raw envelope. */
  signature: string;
}

const SYMBOL_TO_ASSET: Record<string, TradingAsset> = {
  SOL: "SOL",
  JITOSOL: "SOL", // JitoSOL trades are SOL-denominated per docs/POSITION.md §359
  BTC: "BTC",
  WBTC: "BTC",
  BONK: "BONK",
};

function normalizeAsset(symbol: string): TradingAsset | null {
  const key = symbol.toUpperCase();
  return SYMBOL_TO_ASSET[key] ?? null;
}

function normalizeDirection(side: ApiPosition["side"]): TradeDirection | null {
  if (side === "long") return "LONG";
  if (side === "short") return "SHORT";
  return null;
}

function isoToUnixSeconds(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return null;
  return Math.floor(ms / 1000);
}

/**
 * Map a position row to a trade event.
 *
 * Returns:
 *   - `{ kind: 'close', event }` for trader-initiated closes.
 *   - `{ kind: 'liquidate', event }` for forced liquidations. Caller decides
 *     whether the bounty type accepts this.
 *   - `{ kind: 'skip', reason }` for rows that aren't claim-eligible at all
 *     (still open, missing required fields, unsupported symbol).
 */
export function apiPositionToTradeEvent(
  position: ApiPosition,
  args: TradeFromApiArgs,
): TradeFromApiResult {
  if (position.status === "open") {
    return { kind: "skip", reason: "position is still open" };
  }

  const asset = normalizeAsset(position.symbol);
  if (!asset) {
    return {
      kind: "skip",
      reason: `unsupported symbol: ${position.symbol}`,
    };
  }

  const direction = normalizeDirection(position.side);
  if (!direction) {
    return {
      kind: "skip",
      reason: `unsupported side: ${position.side}`,
    };
  }

  if (position.exit_price === null) {
    return { kind: "skip", reason: "missing exit_price" };
  }
  if (position.pnl === null) {
    return { kind: "skip", reason: "missing pnl" };
  }
  if (position.exit_date === null) {
    return { kind: "skip", reason: "missing exit_date" };
  }

  const openTs = isoToUnixSeconds(position.entry_date);
  const closeTs = isoToUnixSeconds(position.exit_date);
  if (openTs === null) return { kind: "skip", reason: "invalid entry_date" };
  if (closeTs === null) return { kind: "skip", reason: "invalid exit_date" };

  // Anti-exploit: denominator MUST be entry collateral, not live collateral.
  if (position.entry_collateral_amount.lte(0)) {
    return {
      kind: "skip",
      reason: "entry_collateral_amount is zero or negative",
    };
  }

  const pnlPercent = position.pnl
    .div(position.entry_collateral_amount)
    .mul(100);

  const event: AdrenaTradeEvent = {
    wallet: args.wallet,
    asset,
    direction,
    entry_price: position.entry_price.toNumber(),
    exit_price: position.exit_price.toNumber(),
    leverage: position.entry_leverage.toNumber(),
    position_size_usd: position.entry_size.toNumber(),
    pnl_usd: position.pnl.toNumber(),
    pnl_percent: pnlPercent.toNumber(),
    duration_minutes: (position.duration ?? 0) / 60,
    open_timestamp: openTs,
    close_timestamp: closeTs,
    tx_signature: args.signature,
  };

  return {
    kind: position.status === "liquidate" ? "liquidate" : "close",
    event,
  };
}

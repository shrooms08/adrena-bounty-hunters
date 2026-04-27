import type { AdrenaTradeEvent } from "@/types";
import { mintToAsset, sideToDirection, USD_SCALE } from "../constants/adrena";
import type {
  DecodedClosePositionEvent,
  DecodedOpenPositionEvent,
} from "./event-decoder";

export interface OpenContext {
  event: DecodedOpenPositionEvent;
  blockTime: number; // unix seconds
}

export type ComposeResult =
  | { status: "complete"; event: AdrenaTradeEvent }
  | {
      status: "open_missing";
      positionId: string;
      owner: string;
      reason: "open event not indexed; backfill required";
    }
  | {
      status: "invalid";
      reason: string;
      positionId: string;
      owner: string;
    };

const toUsd = (raw: { toString(): string }): number =>
  Number(raw.toString()) / USD_SCALE;

// Price is u64 scaled by 10^10 (Cortex::PRICE_DECIMALS in adrena-abi/src/types.rs:266).
// Verified empirically against BTC close at slot 414939732: raw=792_498_675_000_000,
// /1e10 = $79,249.87 — matches BTC price at that time. Amounts (sizeUsd, profit,
// etc.) are separately scaled by 10^6 (USD_SCALE).
const PRICE_SCALE = 1e10;
const toPrice = (raw: { toString(): string }): number =>
  Number(raw.toString()) / PRICE_SCALE;

export interface ComposeInput {
  close: DecodedClosePositionEvent;
  closeBlockTime: number; // unix seconds
  closeSignature: string;
  open: OpenContext | null;
}

export function composeTradeEvent(input: ComposeInput): ComposeResult {
  const { close, closeBlockTime, closeSignature, open } = input;

  const owner = close.owner.toBase58();
  const positionId = close.positionId.toString();

  if (!open) {
    return {
      status: "open_missing",
      positionId,
      owner,
      reason: "open event not indexed; backfill required",
    };
  }

  // Integrity: open event must be for the same position — same owner +
  // positionId + custodyMint + side. Otherwise we're joining the wrong rows.
  if (open.event.positionId.toString() !== positionId) {
    return {
      status: "invalid",
      reason: `positionId mismatch: close=${positionId}, open=${open.event.positionId.toString()}`,
      positionId,
      owner,
    };
  }
  if (!open.event.owner.equals(close.owner)) {
    return {
      status: "invalid",
      reason: "owner mismatch between open and close events",
      positionId,
      owner,
    };
  }
  if (!open.event.custodyMint.equals(close.custodyMint)) {
    return {
      status: "invalid",
      reason: "custodyMint mismatch between open and close events",
      positionId,
      owner,
    };
  }
  if (open.event.side !== close.side) {
    return {
      status: "invalid",
      reason: `side mismatch: close=${close.side}, open=${open.event.side}`,
      positionId,
      owner,
    };
  }

  const direction = sideToDirection(close.side);
  if (!direction) {
    return {
      status: "invalid",
      reason: `unsupported side value: ${close.side} (expected 1=Long, 2=Short)`,
      positionId,
      owner,
    };
  }

  const asset = mintToAsset(close.custodyMint.toBase58());
  if (!asset) {
    return {
      status: "invalid",
      reason: `unknown custodyMint: ${close.custodyMint.toBase58()}`,
      positionId,
      owner,
    };
  }

  const entryPrice = toPrice(open.event.price);
  const exitPrice = toPrice(close.price);
  const positionSizeUsd = toUsd(close.sizeUsd);

  // Anti-exploit: PnL% is denominated by the INITIAL collateral from the
  // open event, not the collateral reported in the close event. A trader
  // could otherwise remove collateral mid-trade to inflate pnl_percent on
  // the close-side report. (ZeDef flagged.)
  const initialCollateralUsd = toUsd(open.event.collateralAmountUsd);

  const profitUsd = toUsd(close.profitUsd);
  const lossUsd = toUsd(close.lossUsd);
  const pnlUsd = profitUsd - lossUsd;

  const pnlPercent =
    initialCollateralUsd > 0 ? (pnlUsd / initialCollateralUsd) * 100 : 0;

  const openTimestamp = open.blockTime;
  const closeTimestamp = closeBlockTime;
  const durationMinutes = Math.max(0, (closeTimestamp - openTimestamp) / 60);

  const leverage = open.event.leverage; // Anchor decodes u32 → number

  const event: AdrenaTradeEvent = {
    wallet: owner,
    asset,
    direction,
    entry_price: entryPrice,
    exit_price: exitPrice,
    leverage,
    position_size_usd: positionSizeUsd,
    pnl_usd: pnlUsd,
    pnl_percent: pnlPercent,
    duration_minutes: durationMinutes,
    open_timestamp: openTimestamp,
    close_timestamp: closeTimestamp,
    tx_signature: closeSignature,
  };

  return { status: "complete", event };
}

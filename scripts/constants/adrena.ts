import type { TradeDirection, TradingAsset } from "@/types";

// Source of truth: /Users/minos/Projects/adrena-reference/adrena-abi/src/lib.rs
export const ADRENA_PROGRAM_ID = "13gDzEXCdocbj8iAiqrScGo47NiSuYENGsRqi3SEAwet";

// Adrena USD amounts and prices are u64 with 6 decimals.
export const USD_DECIMALS = 6;
export const USD_SCALE = 10 ** USD_DECIMALS;

// custodyMint → asset symbol. JITO-collateral longs are SOL-denominated
// and surface as SOL for v1 (see plan §3).
export const MINT_TO_ASSET: Record<string, TradingAsset> = {
  So11111111111111111111111111111111111111112: "SOL",
  J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn: "SOL",
  "3NZ9JMVBmGAqocybic2c7LQCJScmgsAZ6vQqTDzcqmJh": "BTC",
  DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263: "BONK",
};

export function mintToAsset(mintBase58: string): TradingAsset | null {
  return MINT_TO_ASSET[mintBase58] ?? null;
}

// Verified against adrena-abi/src/types.rs:635-660
//   pub enum Side { None = 0, Long = 1, Short = 2 }
export const SIDE_NONE = 0;
export const SIDE_LONG = 1;
export const SIDE_SHORT = 2;

export function sideToDirection(side: number): TradeDirection | null {
  if (side === SIDE_LONG) return "LONG";
  if (side === SIDE_SHORT) return "SHORT";
  return null;
}

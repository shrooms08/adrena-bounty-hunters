// Barrel re-export of canonical Bounty types defined in ./bounty.
// Preserves the @/types import surface for the 23+ existing consumers.
export type {
  BountyTier,
  BountyStatus,
  BountySide,
  TradeDirection,
  TradingAsset,
  BountyRow,
  BountyView,
  AlphaTrader,
  TradeCallout,
  LiveFeedItem,
  TraderProgress,
} from "./bounty";
export { bountyRowToView } from "./bounty";

import type { BountyTier, TradingAsset, TradeDirection } from "./bounty";

export interface Claim {
  id: string;
  bounty_id: string;
  wallet: string;
  trade_tx: string;
  pnl_percent: number;
  asset: TradingAsset;
  direction: TradeDirection;
  leverage: number;
  duration_minutes: number;
  claimed_at: string;
  bounty_title?: string;
  bounty_tier?: BountyTier;
  reward_points?: number;
}

export interface UserStats {
  wallet: string;
  total_claims: number;
  total_points: number;
  current_streak: number;
  best_streak: number;
  last_claim_at: string | null;
}

export interface Callout {
  id: string;
  wallet: string;
  bounty_id: string;
  prediction: string;
  asset: TradingAsset;
  direction: TradeDirection;
  status: "pending" | "success" | "rekt";
  result: string | null;
  created_at: string;
}

export interface AdrenaTradeEvent {
  wallet: string;
  asset: TradingAsset;
  direction: TradeDirection;
  entry_price: number;
  exit_price: number;
  leverage: number;
  position_size_usd: number;
  pnl_usd: number;
  pnl_percent: number;
  duration_minutes: number;
  open_timestamp: number;
  close_timestamp: number;
  tx_signature: string;
}

export const TIER_CONFIG: Record<
  BountyTier,
  { color: string; glow: string; bg: string; label: string }
> = {
  common: {
    color: "#4ade80",
    glow: "0 0 24px rgba(74, 222, 128, 0.2)",
    bg: "rgba(74, 222, 128, 0.08)",
    label: "Common",
  },
  rare: {
    color: "#c084fc",
    glow: "0 0 24px rgba(192, 132, 252, 0.2)",
    bg: "rgba(192, 132, 252, 0.08)",
    label: "Rare",
  },
  legendary: {
    color: "#fbbf24",
    glow: "0 0 24px rgba(251, 191, 36, 0.2)",
    bg: "rgba(251, 191, 36, 0.08)",
    label: "Legendary",
  },
};

export const ASSET_ICONS: Record<TradingAsset, string> = {
  SOL: "◎",
  BTC: "₿",
  BONK: "🐕",
};

export type BountyTier = "common" | "rare" | "legendary";

export type BountyStatus = "active" | "claimed" | "expired";

export type TradeDirection = "LONG" | "SHORT";

export type TradingAsset = "SOL" | "BTC" | "BONK";

export interface Bounty {
  id: string;
  title: string;
  description: string;
  asset: TradingAsset;
  direction: TradeDirection | null;
  min_pnl_percent: number | null;
  max_pnl_percent: number | null;
  min_leverage: number | null;
  max_leverage: number | null;
  max_duration_minutes: number | null;
  min_position_size_usd: number;
  tier: BountyTier;
  reward_points: number;
  status: BountyStatus;
  claimed_by: string | null;
  claimed_at: string | null;
  claimed_trade_tx: string | null;
  created_at: string;
  expires_at: string;
}

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
    color: "#22c55e",
    glow: "0 0 20px rgba(34, 197, 94, 0.3)",
    bg: "rgba(34, 197, 94, 0.1)",
    label: "Common",
  },
  rare: {
    color: "#a855f7",
    glow: "0 0 20px rgba(168, 85, 247, 0.3)",
    bg: "rgba(168, 85, 247, 0.1)",
    label: "Rare",
  },
  legendary: {
    color: "#ffd700",
    glow: "0 0 20px rgba(255, 215, 0, 0.3)",
    bg: "rgba(255, 215, 0, 0.1)",
    label: "Legendary",
  },
};

export const ASSET_ICONS: Record<TradingAsset, string> = {
  SOL: "◎",
  BTC: "₿",
  BONK: "🐕",
};

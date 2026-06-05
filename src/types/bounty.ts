// === Shared enums (single source of truth) ===
export type BountyTier = "common" | "rare" | "legendary";
export type BountyStatus = "active" | "claimed" | "expired";
export type BountySide = "long" | "short" | "any";
export type TradeDirection = "LONG" | "SHORT";
export type TradingAsset = "SOL" | "BTC" | "BONK";

// Legacy alias — TradeCallout etc. reference it. Kept to preserve
// existing definitions verbatim. New code should use TradingAsset.
export type Asset = TradingAsset;

// === DB shape — runtime / API boundary ===
// Matches the Supabase `bounties` row exactly.
// snake_case, nullable columns expressed as `T | null`.
export interface BountyRow {
  id: string;
  title: string;
  description: string;
  tier: BountyTier;
  asset: TradingAsset;
  direction: TradeDirection | null;
  min_pnl_percent: number | null;
  max_pnl_percent: number | null;
  min_leverage: number | null;
  max_leverage: number | null;
  max_duration_minutes: number | null;
  min_position_size_usd: number;
  reward_points: number;
  status: BountyStatus;
  claimed_by: string | null;
  claimed_at: string | null;
  claimed_trade_tx: string | null;
  created_at: string;
  expires_at: string;
}

// === UI shape — what components consume ===
// camelCase, optionals via `?`, includes computed/derived fields.
export interface BountyView {
  id: string;
  tier: BountyTier;
  title: string;
  description: string;
  asset: TradingAsset;
  side: BountySide;
  minLeverage?: number;
  maxLeverage?: number;
  minPnlPercent?: number;
  maxPnlPercent?: number;
  minCollateralUsd?: number;
  maxDurationMinutes?: number;
  rewardPoints: number;
  expiresAt: string;
  createdAt: string;
  state: BountyStatus;
  claimedBy?: string;
  claimedAt?: string;
  activeHuntersCount: number;
}

// === Mapper ===
export function bountyRowToView(
  row: BountyRow,
  activeHuntersCount = 0,
): BountyView {
  return {
    id: row.id,
    tier: row.tier,
    title: row.title,
    description: row.description,
    asset: row.asset,
    side:
      row.direction === null
        ? "any"
        : (row.direction.toLowerCase() as BountySide),
    minLeverage: row.min_leverage ?? undefined,
    maxLeverage: row.max_leverage ?? undefined,
    minPnlPercent: row.min_pnl_percent ?? undefined,
    maxPnlPercent: row.max_pnl_percent ?? undefined,
    minCollateralUsd: row.min_position_size_usd,
    maxDurationMinutes: row.max_duration_minutes ?? undefined,
    rewardPoints: row.reward_points,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    state: row.status,
    claimedBy: row.claimed_by ?? undefined,
    claimedAt: row.claimed_at ?? undefined,
    activeHuntersCount,
  };
}

// === Non-Bounty types preserved verbatim from the legacy file ===
export interface TraderProgress {
  trader: string;
  progress: number;
}

export interface TradeCallout {
  id: string;
  trader: string;
  asset: Asset;
  direction: "LONG" | "SHORT";
  leverage: number;
  thesis: string;
  createdAt: string;
}

export interface LiveFeedItem {
  id: string;
  type: "claim" | "trade";
  trader: string;
  content: string;
  timestamp: string;
}

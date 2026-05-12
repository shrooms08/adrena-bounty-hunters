export type BountyTier = "common" | "rare" | "legendary";
export type BountyAsset = "SOL" | "BTC" | "BONK" | "JITO";
export type BountySide = "long" | "short" | "any";
export type BountyState = "active" | "claimed" | "expired";
export type BountyRewardToken = "ADX" | "USDC";

export interface Bounty {
  id: string;
  tier: BountyTier;
  title: string;
  description: string;

  asset: BountyAsset;
  side: BountySide;
  minLeverage?: number;
  maxLeverage?: number;
  minPnlPercent?: number;
  maxPnlPercent?: number;
  minCollateralUsd?: number;
  maxDurationMinutes?: number;

  rewardAmount: number;
  rewardToken: BountyRewardToken;

  expiresAt: string;
  createdAt: string;

  state: BountyState;
  claimedBy?: string;
  claimedAt?: string;

  activeHuntersCount: number;
}

export type Asset = "SOL" | "BTC" | "BONK";

export type BountyTier = "common" | "rare" | "legendary";

export type BountyStatus = "open" | "claimed" | "expired";

export interface TraderProgress {
  trader: string;
  progress: number;
}

export interface Bounty {
  id: string;
  title: string;
  description: string;
  tier: BountyTier;
  asset: Asset;
  leverage: number;
  rewardPoints: number;
  endsAt: string;
  status: BountyStatus;
  progress: TraderProgress[];
}

export interface AlphaTrader {
  handle: string;
  asset: Asset;
  direction: "LONG" | "SHORT";
  pnlPercent: number;
  leverage: number;
  conviction: number;
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

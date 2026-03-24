import type { TradingAsset } from "@/types";

export const ADRENA_PROGRAM_ID = "13gDzEXCdocbj8iAiqrScGo47NiSuYENGsRqi3SEAwet";

export const SOLANA_RPC =
  process.env.NEXT_PUBLIC_SOLANA_RPC ?? "https://api.mainnet-beta.solana.com";

export function truncateWallet(addr: string): string {
  if (addr.length <= 10) {
    return addr;
  }

  return `${addr.slice(0, 4)}...${addr.slice(-4)}`;
}

export const ASSET_CONFIG: Record<
  TradingAsset,
  { name: string; symbol: TradingAsset; icon: string; color: string }
> = {
  SOL: {
    name: "Solana",
    symbol: "SOL",
    icon: "◎",
    color: "#9945FF",
  },
  BTC: {
    name: "Bitcoin",
    symbol: "BTC",
    icon: "₿",
    color: "#F7931A",
  },
  BONK: {
    name: "Bonk",
    symbol: "BONK",
    icon: "🐕",
    color: "#F5A623",
  },
};

export const MIN_POSITION_SIZE_USD = 50;

export const MAX_CLAIMS_PER_HOUR = 3;

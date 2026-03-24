import type {
  AlphaTrader,
  Bounty,
  BountyTier,
  LiveFeedItem,
  TradeCallout,
} from "@/types/bounty";

const now = Date.now();

const minutesFromNow = (minutes: number): string =>
  new Date(now + minutes * 60_000).toISOString();

export const bounties: Bounty[] = [
  {
    id: "BNT-001",
    title: "SOL Momentum Sniper",
    description: "Hit 5-10% profit on a SOL long in under 30 minutes.",
    tier: "legendary",
    asset: "SOL",
    leverage: 35,
    rewardPoints: 550,
    endsAt: minutesFromNow(47),
    status: "claimed",
    progress: [
      { trader: "sol_ryu", progress: 82 },
      { trader: "gammaqueen", progress: 64 },
      { trader: "bonsai_bonk", progress: 41 },
    ],
  },
  {
    id: "BNT-002",
    title: "BTC Reversal Hunter",
    description: "Catch a 3% bounce after a 1h downtrend on BTC.",
    tier: "rare",
    asset: "BTC",
    leverage: 20,
    rewardPoints: 300,
    endsAt: minutesFromNow(83),
    status: "expired",
    progress: [
      { trader: "satstack", progress: 76 },
      { trader: "driftgod", progress: 52 },
      { trader: "vanta", progress: 38 },
    ],
  },
  {
    id: "BNT-003",
    title: "BONK Breakout Blitz",
    description: "Execute a BONK breakout with 2 profitable closes in 20m.",
    tier: "common",
    asset: "BONK",
    leverage: 55,
    rewardPoints: 180,
    endsAt: minutesFromNow(22),
    status: "open",
    progress: [
      { trader: "memeops", progress: 92 },
      { trader: "mikabonk", progress: 69 },
      { trader: "hunt3r", progress: 48 },
    ],
  },
  {
    id: "BNT-004",
    title: "Cross-Asset Scalper",
    description: "Close one SOL and one BTC scalp both in profit in 45m.",
    tier: "rare",
    asset: "SOL",
    leverage: 18,
    rewardPoints: 320,
    endsAt: minutesFromNow(128),
    status: "open",
    progress: [
      { trader: "orbital", progress: 58 },
      { trader: "zev", progress: 45 },
      { trader: "vexel", progress: 34 },
    ],
  },
];

export const alphaTrader: AlphaTrader = {
  handle: "xsolstice",
  asset: "SOL",
  direction: "LONG",
  pnlPercent: 14.82,
  leverage: 42,
  conviction: 91,
};

export const tradeCallouts: TradeCallout[] = [
  {
    id: "CO-1",
    trader: "gammaqueen",
    asset: "SOL",
    direction: "LONG",
    leverage: 28,
    thesis: "Funding cooled, momentum building above local resistance.",
    createdAt: minutesFromNow(-8),
  },
  {
    id: "CO-2",
    trader: "driftgod",
    asset: "BTC",
    direction: "SHORT",
    leverage: 16,
    thesis: "Expecting rejection on the hourly supply zone.",
    createdAt: minutesFromNow(-17),
  },
  {
    id: "CO-3",
    trader: "mikabonk",
    asset: "BONK",
    direction: "LONG",
    leverage: 63,
    thesis: "High-risk breakout setup into meme beta rotation.",
    createdAt: minutesFromNow(-4),
  },
];

export const liveFeed: LiveFeedItem[] = [
  {
    id: "LF-1",
    type: "claim",
    trader: "sol_ryu",
    content: "claimed BONK Breakout Blitz for +180 points",
    timestamp: minutesFromNow(-2),
  },
  {
    id: "LF-2",
    type: "trade",
    trader: "satstack",
    content: "opened BTC SHORT 14x at 68,420",
    timestamp: minutesFromNow(-3),
  },
  {
    id: "LF-3",
    type: "trade",
    trader: "xsolstice",
    content: "scaled into SOL LONG 42x at 181.3",
    timestamp: minutesFromNow(-6),
  },
  {
    id: "LF-4",
    type: "claim",
    trader: "vanta",
    content: "sniped BTC Reversal Hunter for +300 points",
    timestamp: minutesFromNow(-11),
  },
  {
    id: "LF-5",
    type: "trade",
    trader: "hunt3r",
    content: "closed BONK LONG for +6.2% PnL",
    timestamp: minutesFromNow(-13),
  },
];

export const tierColorMap: Record<BountyTier, string> = {
  common: "#22c55e",
  rare: "#a855f7",
  legendary: "#ffd700",
};

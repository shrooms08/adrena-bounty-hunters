import type { BountyTier, TradeDirection, TradingAsset } from "@/types";

interface GeneratedBounty {
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
  status: "active";
  claimed_by: null;
  claimed_at: null;
  claimed_trade_tx: null;
  created_at: string;
  expires_at: string;
}

type WeightedTemplate = {
  name: string;
  tier: BountyTier;
  weight: number;
  build: () => Omit<GeneratedBounty, "created_at" | "expires_at" | "status" | "claimed_by" | "claimed_at" | "claimed_trade_tx">;
};

const pickOne = <T>(items: readonly T[]): T =>
  items[Math.floor(Math.random() * items.length)];

const addMinutes = (minutes: number): string =>
  new Date(Date.now() + minutes * 60_000).toISOString();

const withTierExpiry = (tier: BountyTier): string => {
  if (tier === "common") return addMinutes(120);
  if (tier === "rare") return addMinutes(90);
  return addMinutes(60);
};

const commonTemplates: WeightedTemplate[] = [
  {
    name: "Quick Flip",
    tier: "common",
    weight: 4,
    build: () => {
      const asset = pickOne<TradingAsset>(["SOL", "BTC", "BONK"]);
      return {
        title: `Quick Flip: ${asset}`,
        description: `Close a fast ${asset} trade with at least 3% PnL.`,
        asset,
        direction: null,
        min_pnl_percent: 3,
        max_pnl_percent: null,
        min_leverage: null,
        max_leverage: null,
        max_duration_minutes: null,
        min_position_size_usd: 50,
        tier: "common",
        reward_points: 50,
      };
    },
  },
  {
    name: "Precision Strike",
    tier: "common",
    weight: 3,
    build: () => {
      const asset = pickOne<TradingAsset>(["SOL", "BTC"]);
      const direction = pickOne<TradeDirection>(["LONG", "SHORT"]);
      const range = pickOne([
        { min: 5, max: 10 },
        { min: 3, max: 8 },
      ]);
      return {
        title: `Precision Strike: ${asset} ${direction}`,
        description: `Hit a controlled ${asset} ${direction} with ${range.min}-${range.max}% profit.`,
        asset,
        direction,
        min_pnl_percent: range.min,
        max_pnl_percent: range.max,
        min_leverage: null,
        max_leverage: null,
        max_duration_minutes: null,
        min_position_size_usd: 50,
        tier: "common",
        reward_points: 50,
      };
    },
  },
  {
    name: "The BONK Job",
    tier: "common",
    weight: 3,
    build: () => ({
      title: "The BONK Job",
      description: "Farm a BONK move with at least 1% PnL in either direction.",
      asset: "BONK",
      direction: null,
      min_pnl_percent: 1,
      max_pnl_percent: null,
      min_leverage: null,
      max_leverage: null,
      max_duration_minutes: null,
      min_position_size_usd: 50,
      tier: "common",
      reward_points: 50,
    }),
  },
];

const rareTemplates: WeightedTemplate[] = [
  {
    name: "Speed Demon",
    tier: "rare",
    weight: 2,
    build: () => {
      const asset = pickOne<TradingAsset>(["SOL", "BTC"]);
      const maxDuration = pickOne([15, 30]);
      const points = pickOne([150, 200]);
      return {
        title: `Speed Demon: ${asset}`,
        description: `Execute a rapid ${asset} scalp with 2%+ PnL in ${maxDuration} minutes.`,
        asset,
        direction: null,
        min_pnl_percent: 2,
        max_pnl_percent: null,
        min_leverage: null,
        max_leverage: null,
        max_duration_minutes: maxDuration,
        min_position_size_usd: 50,
        tier: "rare",
        reward_points: points,
      };
    },
  },
  {
    name: "Bear Trap",
    tier: "rare",
    weight: 2,
    build: () => {
      const asset = pickOne<TradingAsset>(["SOL", "BTC"]);
      const minPnl = pickOne([5, 8]);
      const points = pickOne([150, 200]);
      return {
        title: `Bear Trap: ${asset}`,
        description: `Catch a ${asset} SHORT setup and lock at least ${minPnl}% PnL.`,
        asset,
        direction: "SHORT",
        min_pnl_percent: minPnl,
        max_pnl_percent: null,
        min_leverage: null,
        max_leverage: null,
        max_duration_minutes: null,
        min_position_size_usd: 50,
        tier: "rare",
        reward_points: points,
      };
    },
  },
  {
    name: "Steady Hands",
    tier: "rare",
    weight: 2,
    build: () => {
      const asset = pickOne<TradingAsset>(["SOL", "BTC"]);
      const direction = pickOne<TradeDirection>(["LONG", "SHORT"]);
      const minLeverage = pickOne([10, 20]);
      const points = pickOne([150, 200]);
      return {
        title: `Steady Hands: ${asset}`,
        description: `Take a disciplined ${asset} ${direction} at ${minLeverage}x+ and secure 5%+.`,
        asset,
        direction,
        min_pnl_percent: 5,
        max_pnl_percent: null,
        min_leverage: minLeverage,
        max_leverage: null,
        max_duration_minutes: null,
        min_position_size_usd: 50,
        tier: "rare",
        reward_points: points,
      };
    },
  },
];

const legendaryTemplates: WeightedTemplate[] = [
  {
    name: "Whale Hunter",
    tier: "legendary",
    weight: 1,
    build: () => {
      const asset = pickOne<TradingAsset>(["SOL", "BTC"]);
      const direction = pickOne<TradeDirection>(["LONG", "SHORT"]);
      const minLeverage = pickOne([25, 50]);
      const minPnl = pickOne([10, 15]);
      return {
        title: `Whale Hunter: ${asset}`,
        description: `Land a ${asset} ${direction} at ${minLeverage}x+ with ${minPnl}%+ PnL.`,
        asset,
        direction,
        min_pnl_percent: minPnl,
        max_pnl_percent: null,
        min_leverage: minLeverage,
        max_leverage: null,
        max_duration_minutes: null,
        min_position_size_usd: 50,
        tier: "legendary",
        reward_points: 500,
      };
    },
  },
  {
    name: "Lightning Round",
    tier: "legendary",
    weight: 1,
    build: () => {
      const asset = pickOne<TradingAsset>(["SOL", "BTC", "BONK"]);
      const direction = pickOne<TradeDirection>(["LONG", "SHORT"]);
      return {
        title: "Lightning Round",
        description: `Explode a ${asset} ${direction} for 10%+ PnL in 10 minutes or less.`,
        asset,
        direction,
        min_pnl_percent: 10,
        max_pnl_percent: null,
        min_leverage: null,
        max_leverage: null,
        max_duration_minutes: 10,
        min_position_size_usd: 50,
        tier: "legendary",
        reward_points: 500,
      };
    },
  },
];

const allTemplates: WeightedTemplate[] = [
  ...commonTemplates,
  ...rareTemplates,
  ...legendaryTemplates,
];

const pickWeighted = (templates: WeightedTemplate[]): WeightedTemplate => {
  const total = templates.reduce((sum, template) => sum + template.weight, 0);
  let cursor = Math.random() * total;

  for (const template of templates) {
    cursor -= template.weight;
    if (cursor <= 0) return template;
  }

  return templates[templates.length - 1];
};

const ensureUniqueTitle = (
  title: string,
  counts: Map<string, number>,
): string => {
  const current = counts.get(title) ?? 0;
  counts.set(title, current + 1);

  if (current === 0) return title;
  return `${title} #${current + 1}`;
};

const buildFromTemplate = (
  template: WeightedTemplate,
  titleCounts: Map<string, number>,
): GeneratedBounty => {
  const base = template.build();
  const createdAt = new Date().toISOString();

  return {
    ...base,
    title: ensureUniqueTitle(base.title, titleCounts),
    created_at: createdAt,
    expires_at: withTierExpiry(template.tier),
    status: "active",
    claimed_by: null,
    claimed_at: null,
    claimed_trade_tx: null,
  };
};

export function generateBounties(count = 8): GeneratedBounty[] {
  const target = Math.max(1, count);
  const titleCounts = new Map<string, number>();
  const generated: GeneratedBounty[] = [];

  const minimumPlan: WeightedTemplate[] = [
    ...Array.from({ length: 4 }, () => pickWeighted(commonTemplates)),
    ...Array.from({ length: 2 }, () => pickWeighted(rareTemplates)),
    pickWeighted(legendaryTemplates),
  ];

  for (const template of minimumPlan) {
    if (generated.length >= target) break;
    generated.push(buildFromTemplate(template, titleCounts));
  }

  while (generated.length < target) {
    const template = pickWeighted(allTemplates);
    generated.push(buildFromTemplate(template, titleCounts));
  }

  return generated;
}

export type { GeneratedBounty };

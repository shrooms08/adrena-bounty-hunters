"use client";

import { motion } from "framer-motion";
import { TIER_VISUAL } from "@/components/tier-visuals";
import type { BountyTier } from "@/types";

interface LiveClaimItem {
  wallet: string;
  title: string;
  tier: BountyTier;
  points: number;
  ago: string;
}

const liveClaims: LiveClaimItem[] = [
  { wallet: "7xKp...3mNq", title: "Quick Flip: SOL", tier: "common", points: 50, ago: "2m ago" },
  { wallet: "4mDz...KpV", title: "Speed Demon: BTC", tier: "rare", points: 150, ago: "5m ago" },
  { wallet: "9pBn...GdF", title: "Lightning Round", tier: "legendary", points: 500, ago: "8m ago" },
  { wallet: "2sLw...TdV", title: "The BONK Job", tier: "common", points: 50, ago: "12m ago" },
  { wallet: "5kHn...MpL", title: "Bear Trap: BTC", tier: "rare", points: 150, ago: "18m ago" },
  { wallet: "8fVw...JhC", title: "Whale Hunter: SOL", tier: "legendary", points: 500, ago: "22m ago" },
  { wallet: "3tBz...CpN", title: "Precision Strike: BTC", tier: "common", points: 50, ago: "25m ago" },
];

export function ClaimFeed() {
  return (
    <aside className="overflow-hidden rounded-2xl border border-white/[0.06] bg-[#1a1735]">
      <header className="flex items-center gap-2 border-b border-white/[0.06] px-4 py-3.5">
        <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse-glow" />
        <span className="font-heading text-[10px] font-medium uppercase tracking-[0.15em] text-gray-500">
          Live claims
        </span>
      </header>
      <div className="max-h-[540px] overflow-y-auto">
        {liveClaims.map((item, idx) => {
          const visual = TIER_VISUAL[item.tier];
          return (
            <motion.div
              key={`${item.wallet}-${item.title}`}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.05, duration: 0.22 }}
              className="border-b border-white/[0.04] px-4 py-3 last:border-b-0"
            >
              <div className="flex items-center gap-2">
                <span
                  className="h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ backgroundColor: visual.color }}
                />
                <span className="font-mono text-xs text-gray-500">{item.wallet}</span>
                <span
                  className="truncate text-xs font-medium"
                  style={{ color: visual.color }}
                  title={item.title}
                >
                  {item.title}
                </span>
                <span className="ml-auto shrink-0 tabular-nums font-heading text-xs font-semibold text-emerald-400">
                  +{item.points}
                </span>
              </div>
              <p className="mt-1 pl-[14px] text-[10px] text-gray-600">{item.ago}</p>
            </motion.div>
          );
        })}
      </div>
    </aside>
  );
}

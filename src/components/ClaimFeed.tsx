"use client";

import { motion } from "framer-motion";

type ClaimTier = "common" | "rare" | "legendary";

interface LiveClaimItem {
  wallet: string;
  title: string;
  tier: ClaimTier;
  points: number;
  ago: string;
}

const liveClaims: LiveClaimItem[] = [
  {
    wallet: "7xKp...3mNq",
    title: "Quick Flip: SOL",
    tier: "common",
    points: 50,
    ago: "2m ago",
  },
  {
    wallet: "4mDz...KpV",
    title: "Speed Demon: BTC",
    tier: "rare",
    points: 150,
    ago: "5m ago",
  },
  {
    wallet: "9pBn...GdF",
    title: "Lightning Round",
    tier: "legendary",
    points: 500,
    ago: "8m ago",
  },
  {
    wallet: "2sLw...TdV",
    title: "The BONK Job",
    tier: "common",
    points: 50,
    ago: "12m ago",
  },
  {
    wallet: "5kHn...MpL",
    title: "Bear Trap: BTC",
    tier: "rare",
    points: 150,
    ago: "18m ago",
  },
  {
    wallet: "8fVw...JhC",
    title: "Whale Hunter: SOL",
    tier: "legendary",
    points: 500,
    ago: "22m ago",
  },
  {
    wallet: "3tBz...CpN",
    title: "Precision Strike: BTC",
    tier: "common",
    points: 50,
    ago: "25m ago",
  },
];

const tierColors: Record<ClaimTier, string> = {
  common: "#22c55e",
  rare: "#a855f7",
  legendary: "#ffd700",
};

export function ClaimFeed() {
  return (
    <aside className="overflow-hidden rounded-xl border border-white/[0.06] bg-[#0f0f14]">
      <header className="flex items-center gap-2 border-b border-white/[0.06] px-4 py-3">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-400" />
        <span className="font-mono text-[11px] uppercase tracking-wider text-slate-400">
          Live Claims
        </span>
      </header>
      <div className="max-h-[540px] overflow-y-auto">
        {liveClaims.map((item, idx) => (
          <motion.div
            key={`${item.wallet}-${item.title}`}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: idx * 0.05, duration: 0.22 }}
            className="border-b border-white/[0.03] px-4 py-3"
          >
            <div className="flex items-center gap-2">
              <span
                className="h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ backgroundColor: tierColors[item.tier] }}
              />
              <span className="font-mono text-xs text-slate-300">{item.wallet}</span>
              <span
                className="truncate text-xs"
                style={{ color: tierColors[item.tier] }}
                title={item.title}
              >
                {item.title}
              </span>
              <span className="ml-auto shrink-0 font-mono text-xs text-cyan-400">
                +{item.points}
              </span>
            </div>
            <p className="mt-1 pl-[14px] text-[10px] text-slate-600">{item.ago}</p>
          </motion.div>
        ))}
      </div>
    </aside>
  );
}

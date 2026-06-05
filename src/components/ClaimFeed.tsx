"use client";

import { motion } from "framer-motion";
import { TIER_VISUAL } from "@/components/tier-visuals";
import { useClaims } from "@/hooks/useClaims";
import { truncateWallet } from "@/lib/constants";
import type { BountyTier } from "@/types";

function formatNumber(amount: number): string {
  return amount.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

function timeAgo(iso: string): string {
  const diffSec = Math.max(
    0,
    Math.floor((Date.now() - new Date(iso).getTime()) / 1000),
  );
  if (diffSec < 60) return `${diffSec}s ago`;
  const min = Math.floor(diffSec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const days = Math.floor(hr / 24);
  return `${days}d ago`;
}

export function ClaimFeed() {
  const { claims } = useClaims();

  return (
    <aside className="overflow-hidden rounded-2xl border border-white/[0.06] bg-[#1a1735]">
      <header className="flex items-center gap-2 border-b border-white/[0.06] px-4 py-3.5">
        <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse-glow" />
        <span className="font-heading text-[10px] font-medium uppercase tracking-[0.15em] text-gray-500">
          Live claims
        </span>
      </header>
      <div className="max-h-[540px] overflow-y-auto">
        {claims.length === 0 ? (
          <p className="px-4 py-8 text-center text-xs leading-relaxed text-gray-500">
            No claims yet — be the first to hunt a bounty.
          </p>
        ) : (
          claims.map((item, idx) => {
            const tier = (item.bounty_tier ?? "common") as BountyTier;
            const visual = TIER_VISUAL[tier];
            const title = item.bounty_title ?? "Bounty";
            return (
              <motion.div
                key={item.id}
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
                  <span className="font-mono text-xs text-gray-500">
                    {truncateWallet(item.wallet)}
                  </span>
                  <span
                    className="truncate text-xs font-medium"
                    style={{ color: visual.color }}
                    title={title}
                  >
                    {title}
                  </span>
                  <span className="ml-auto shrink-0 tabular-nums font-heading text-xs font-semibold text-emerald-400">
                    +{formatNumber(item.reward_points ?? 0)} MTG
                  </span>
                </div>
                <p className="mt-1 pl-[14px] text-[10px] text-gray-600">
                  {timeAgo(item.claimed_at)}
                </p>
              </motion.div>
            );
          })
        )}
      </div>
    </aside>
  );
}

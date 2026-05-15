"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { Trophy, Flame, Zap, Target } from "lucide-react";
import { TIER_VISUAL } from "@/components/tier-visuals";
import type { BountyTier } from "@/types";

const MOCK_CLAIMS = [
  { bounty: "SOL Momentum Sniper", tier: "legendary" as BountyTier, asset: "SOL", points: 550, date: "2026-03-23" },
  { bounty: "BTC Reversal Hunter", tier: "rare" as BountyTier, asset: "BTC", points: 300, date: "2026-03-22" },
  { bounty: "BONK Breakout Blitz", tier: "common" as BountyTier, asset: "BONK", points: 180, date: "2026-03-21" },
  { bounty: "Cross-Asset Scalper", tier: "rare" as BountyTier, asset: "SOL", points: 320, date: "2026-03-20" },
  { bounty: "Degen Leverage Play", tier: "legendary" as BountyTier, asset: "BTC", points: 500, date: "2026-03-19" },
];

const STAT_CARDS = [
  { label: "Bounties Claimed", value: "8", icon: Trophy },
  { label: "Total Points", value: "1,200", icon: Zap },
  { label: "Current Streak", value: "3", icon: Flame },
  { label: "Best Streak", value: "5", icon: Target },
] as const;

export default function ProfilePage() {
  const { publicKey, connected } = useWallet();

  if (!connected || !publicKey) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-6">
        <div className="mx-auto mt-24 max-w-sm rounded-2xl border border-white/[0.06] bg-[#1a1735] p-8 text-center">
          <p className="mb-4 text-gray-500">
            Connect your wallet to see your Hunt Log
          </p>
          <div className="flex justify-center">
            <WalletMultiButton />
          </div>
        </div>
      </div>
    );
  }

  const address = publicKey.toBase58();
  const shortAddress = `${address.slice(0, 4)}...${address.slice(-4)}`;

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      {/* Header */}
      <div className="mb-8 rounded-2xl border border-white/[0.06] bg-[#1a1735] p-6">
        <h1 className="font-heading text-2xl font-bold text-white">Hunt Log</h1>
        <p className="mt-1 font-mono text-sm text-gray-500">{shortAddress}</p>
      </div>

      {/* Stat cards */}
      <div className="mb-8 overflow-hidden rounded-2xl border border-white/[0.06] bg-[#1a1735]">
        <div className="grid grid-cols-2 divide-x divide-white/[0.06] md:grid-cols-4">
          {STAT_CARDS.map((stat) => (
            <div key={stat.label} className="flex flex-col items-center px-4 py-5 text-center">
              <stat.icon className="h-5 w-5 text-gray-500" />
              <p className="mt-2 text-[10px] font-medium uppercase tracking-wider text-gray-500">
                {stat.label}
              </p>
              <p className="mt-1 font-heading text-2xl font-bold text-white">
                {stat.value}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Claims table */}
      <div>
        <h2 className="mb-4 font-heading text-lg font-semibold text-white">
          Claimed Bounties
        </h2>
        <div className="overflow-x-auto rounded-2xl border border-white/[0.06] bg-[#1a1735]">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-white/[0.06] text-xs uppercase tracking-wider text-gray-500">
                <th className="px-4 py-3 font-medium">Bounty</th>
                <th className="px-4 py-3 font-medium">Tier</th>
                <th className="px-4 py-3 font-medium">Asset</th>
                <th className="px-4 py-3 font-medium">Points</th>
                <th className="px-4 py-3 font-medium">Date</th>
              </tr>
            </thead>
            <tbody>
              {MOCK_CLAIMS.map((claim, i) => {
                const visual = TIER_VISUAL[claim.tier];
                return (
                  <tr
                    key={i}
                    className="border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02]"
                  >
                    <td className="px-4 py-3 text-white">{claim.bounty}</td>
                    <td className="px-4 py-3">
                      <span
                        className="rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider"
                        style={{
                          color: visual.color,
                          backgroundColor: visual.bg,
                        }}
                      >
                        {claim.tier}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-gray-500">{claim.asset}</td>
                    <td className="px-4 py-3 font-heading font-semibold text-emerald-400">
                      {claim.points}
                    </td>
                    <td className="px-4 py-3 font-mono text-gray-500">{claim.date}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";

const MOCK_CLAIMS = [
  { bounty: "SOL Momentum Sniper", tier: "legendary", asset: "SOL", points: 550, date: "2026-03-23" },
  { bounty: "BTC Reversal Hunter", tier: "rare", asset: "BTC", points: 300, date: "2026-03-22" },
  { bounty: "BONK Breakout Blitz", tier: "common", asset: "BONK", points: 180, date: "2026-03-21" },
  { bounty: "Cross-Asset Scalper", tier: "rare", asset: "SOL", points: 320, date: "2026-03-20" },
  { bounty: "Degen Leverage Play", tier: "legendary", asset: "BTC", points: 500, date: "2026-03-19" },
];

const TIER_COLORS: Record<string, string> = {
  common: "#22c55e",
  rare: "#a855f7",
  legendary: "#ffd700",
};

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-[#13131a] p-4">
      <p className="text-xs text-[var(--text-secondary)]">{label}</p>
      <p className="mt-1 font-mono text-2xl text-[var(--text-primary)]">{value}</p>
    </div>
  );
}

export default function ProfilePage() {
  const { publicKey, connected } = useWallet();

  if (!connected || !publicKey) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-6">
        <div className="mx-auto mt-24 max-w-sm rounded-xl border border-white/[0.06] bg-[#13131a] p-8 text-center">
          <p className="mb-4 text-[var(--text-secondary)]">
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
      <div className="mb-6">
        <h1 className="font-heading text-2xl text-[var(--text-primary)]">Hunt Log</h1>
        <p className="mt-1 font-mono text-sm text-[var(--text-secondary)]">{shortAddress}</p>
      </div>

      <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Bounties Claimed" value="8" />
        <StatCard label="Total Points" value="1,200" />
        <StatCard label="Current Streak" value="3" />
        <StatCard label="Best Streak" value="5" />
      </div>

      <div>
        <h2 className="mb-4 font-heading text-lg text-[var(--text-primary)]">Claimed Bounties</h2>
        <div className="overflow-x-auto rounded-xl border border-white/[0.06] bg-[#13131a]">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-white/5 text-xs uppercase tracking-wider text-[var(--text-secondary)]">
                <th className="px-4 py-3">Bounty</th>
                <th className="px-4 py-3">Tier</th>
                <th className="px-4 py-3">Asset</th>
                <th className="px-4 py-3">Points</th>
                <th className="px-4 py-3">Date</th>
              </tr>
            </thead>
            <tbody>
              {MOCK_CLAIMS.map((claim, i) => (
                <tr key={i} className="border-b border-white/5 last:border-0">
                  <td className="px-4 py-3 text-[var(--text-primary)]">{claim.bounty}</td>
                  <td className="px-4 py-3">
                    <span
                      className="rounded-full px-2 py-0.5 text-[10px] uppercase tracking-[0.16em]"
                      style={{
                        color: TIER_COLORS[claim.tier],
                        backgroundColor: `color-mix(in oklab, ${TIER_COLORS[claim.tier]} 16%, transparent)`,
                      }}
                    >
                      {claim.tier}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-[var(--text-secondary)]">{claim.asset}</td>
                  <td className="px-4 py-3 font-mono text-[var(--accent)]">{claim.points}</td>
                  <td className="px-4 py-3 font-mono text-[var(--text-secondary)]">{claim.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

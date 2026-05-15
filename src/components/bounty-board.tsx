"use client";

import { BountyCard } from "@/components/bounty/BountyCard";
import { useEligibleBounties } from "@/hooks/useEligibleBounties";
import { bountyRowToView } from "@/types";
import type { BountyRow, BountyView } from "@/types";

interface BountyBoardProps {
  bounties: BountyRow[];
  onClaim?: (bounty: BountyView) => void;
}

export function BountyBoard({ bounties, onClaim }: BountyBoardProps) {
  const { eligibleBountyIds } = useEligibleBounties();
  const activeCount = bounties.filter((b) => b.status === "active").length;

  return (
    <section className="mb-10">
      <header className="mb-5 mt-8 flex items-end justify-between gap-4 px-4 lg:mt-10 lg:px-0">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="font-heading text-2xl font-bold text-white">
              Bounty Board
            </h2>
            {activeCount > 0 && (
              <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-bold tabular-nums text-emerald-400">
                {activeCount} live
              </span>
            )}
          </div>
          <p className="mt-1.5 max-w-lg text-sm text-gray-500">
            Live challenges with countdown timers. Complete the trade on Adrena,
            then claim with your tx signature.
          </p>
        </div>
        <p className="shrink-0 text-right text-[10px] font-medium uppercase tracking-wider text-emerald-400/70">
          First-come first-served
        </p>
      </header>

      <div className="grid grid-cols-1 gap-4 px-4 lg:px-0 md:grid-cols-2 lg:grid-cols-3">
        {bounties.map((row) => (
          <BountyCard
            key={row.id}
            bounty={bountyRowToView(row)}
            onClaim={onClaim}
            qualifies={eligibleBountyIds.has(row.id)}
          />
        ))}
      </div>
    </section>
  );
}

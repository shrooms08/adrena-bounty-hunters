"use client";

import { useCallback } from "react";
import { toast } from "sonner";
import { BountyCard } from "@/components/bounty/BountyCard";
import type { ClaimDetails } from "@/hooks/useEligibleBounties";
import type { BountyView } from "@/types";

interface SmokeBountyBoardProps {
  active: BountyView[];
  past: BountyView[];
  qualifyingIds: string[];
  claimDetailsDemo: ClaimDetails;
}

export function SmokeBountyBoard({
  active,
  past,
  qualifyingIds,
  claimDetailsDemo,
}: SmokeBountyBoardProps) {
  const qualifies = new Set(qualifyingIds);

  const handleSmokeClaim = useCallback(
    async (bounty: BountyView) => {
      await new Promise((resolve) => setTimeout(resolve, 800));
      if (Math.random() < 0.6) {
        toast.success(`Claimed: ${bounty.title}`, {
          description: `+${bounty.rewardPoints} MTG · simulated`,
        });
        return;
      }
      toast.error("Claim failed", {
        description: "Smoke test simulated failure — try again",
      });
      throw new Error("simulated");
    },
    [],
  );

  return (
    <>
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-white text-lg font-semibold">
            Active Bounties ({active.length})
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {active.map((b) => (
            <BountyCard
              key={b.id}
              bounty={b}
              qualifies={qualifies.has(b.id)}
              claimDetails={qualifies.has(b.id) ? claimDetailsDemo : undefined}
              onClaim={handleSmokeClaim}
            />
          ))}
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-white text-lg font-semibold">
            Past Bounties ({past.length})
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {past.map((b) => (
            <BountyCard key={b.id} bounty={b} onClaim={handleSmokeClaim} />
          ))}
        </div>
      </section>
    </>
  );
}

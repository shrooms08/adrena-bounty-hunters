"use client";

import { useCallback } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { toast } from "sonner";
import { AlphaHour } from "@/components/alpha-hour";
import { BountyBoard } from "@/components/bounty-board";
import { ClaimFeed } from "@/components/ClaimFeed";
import { StatsBar } from "@/components/stats-bar";
import { useBounties } from "@/hooks/useBounties";
import {
  useEligibleBounties,
  type ClaimDetails,
} from "@/hooks/useEligibleBounties";
import { alphaTrader } from "@/lib/bounty-data";
import type { BountyView } from "@/types";

function BountyBoardSkeleton() {
  return (
    <section className="mb-10">
      <header className="mb-5 mt-8 flex items-end justify-between gap-4 px-4 lg:mt-10 lg:px-0">
        <div className="space-y-2">
          <div className="h-7 w-40 animate-shimmer rounded-md bg-[#1a1735]" />
          <div className="h-4 w-64 max-w-full animate-shimmer rounded bg-[#1a1735]" />
        </div>
      </header>
      <div className="grid grid-cols-1 gap-4 px-4 lg:px-0 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="h-48 animate-shimmer rounded-lg border border-bcolor bg-secondary"
          />
        ))}
      </div>
    </section>
  );
}

export default function BountiesPage() {
  const { bounties, loading, refetch: refetchBounties } = useBounties();
  const { publicKey } = useWallet();
  const {
    eligibleBountyIds,
    claimMap,
    refetch: refetchEligibility,
  } = useEligibleBounties();

  const activeCount = bounties.filter((b) => b.status === "active").length;
  const claimedCount = bounties.filter((b) => b.status === "claimed").length;

  const handleClaim = useCallback(
    async (bounty: BountyView, claimDetails?: ClaimDetails) => {
      if (!publicKey) {
        toast.error("Connect a wallet to claim");
        return;
      }
      if (!claimDetails) {
        toast.error("Missing claim details — please refresh and try again");
        return;
      }

      try {
        const res = await fetch("/api/bounties/claim", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            bounty_id: bounty.id,
            wallet: publicKey.toBase58(),
            signature: claimDetails.signature,
          }),
        });

        if (!res.ok) {
          const errorBody = (await res
            .json()
            .catch(() => ({ error: "unknown" }))) as { error?: string };
          throw new Error(errorBody.error ?? `claim failed: ${res.status}`);
        }

        toast.success(`Claimed: ${bounty.title}`, {
          description: `+${bounty.rewardPoints} mutagen · ${claimDetails.pnlPercent.toFixed(1)}% PnL`,
        });

        refetchBounties();
        refetchEligibility();
      } catch (err) {
        console.error("[claim] failed:", err);
        toast.error("Claim failed", {
          description: err instanceof Error ? err.message : "Unknown error",
        });
        throw err;
      }
    },
    [publicKey, refetchBounties, refetchEligibility],
  );

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-[1400px] lg:px-6">
        <AlphaHour trader={alphaTrader} />

        <StatsBar activeCount={activeCount} claimedCount={claimedCount} />

        <div className="flex gap-8">
          <div className="min-w-0 flex-1">
            {loading ? (
              <BountyBoardSkeleton />
            ) : (
              <BountyBoard
                bounties={bounties}
                onClaim={handleClaim}
                eligibleBountyIds={eligibleBountyIds}
                claimMap={claimMap}
              />
            )}
          </div>
          <div className="hidden w-[300px] shrink-0 pt-8 xl:block">
            <ClaimFeed />
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useCallback } from "react";
import { AlphaHour } from "@/components/alpha-hour";
import { BountyBoard } from "@/components/bounty-board";
import { ClaimFeed } from "@/components/ClaimFeed";
import { StatsBar } from "@/components/stats-bar";
import { useBounties } from "@/hooks/useBounties";
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
      <div className="grid grid-cols-1 gap-4 px-4 lg:px-0">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="h-48 animate-shimmer rounded-2xl border border-white/[0.06] bg-[#1a1735]"
          />
        ))}
      </div>
    </section>
  );
}

export default function BountiesPage() {
  const { bounties, loading } = useBounties();

  const activeCount = bounties.filter((b) => b.status === "active").length;
  const claimedCount = bounties.filter((b) => b.status === "claimed").length;

  const handleClaim = useCallback((bounty: BountyView) => {
    // TODO: wire to /api/bounties/claim once BountyCard v1 lands the full flow.
    console.log("Claim triggered for bounty:", bounty.id);
  }, []);

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
              <BountyBoard bounties={bounties} onClaim={handleClaim} />
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

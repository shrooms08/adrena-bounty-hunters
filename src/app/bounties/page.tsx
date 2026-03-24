"use client";

import { useState } from "react";
import { AlphaHour } from "@/components/alpha-hour";
import { BountyBoard } from "@/components/bounty-board";
import { CallYourShot } from "@/components/CallYourShot";
import { ClaimFeed } from "@/components/ClaimFeed";
import { StatsBar } from "@/components/stats-bar";
import { useBounties } from "@/hooks/useBounties";
import { alphaTrader } from "@/lib/bounty-data";
import type { Bounty } from "@/types";

function BountyBoardSkeleton() {
  return (
    <div className="mb-6">
      <div className="mb-5 h-8 w-48 animate-pulse rounded-lg bg-slate-800/80" />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "16px" }}>
        {Array.from({ length: 9 }).map((_, i) => (
          <div
            key={i}
            className="h-56 animate-pulse rounded-xl bg-slate-800/80"
          />
        ))}
      </div>
    </div>
  );
}

export default function BountiesPage() {
  const { bounties, loading } = useBounties();
  const [selectedBounty, setSelectedBounty] = useState<Bounty | null>(null);

  const activeCount = bounties.filter((b) => b.status === "active").length;
  const claimedCount = bounties.filter((b) => b.status === "claimed").length;

  return (
    <div className="mx-auto max-w-[1400px] px-6 py-6">
      <AlphaHour trader={alphaTrader} />

      <StatsBar activeCount={activeCount} claimedCount={claimedCount} />

      <div className="flex gap-6">
        <div className="min-w-0 flex-1">
          {loading ? (
            <BountyBoardSkeleton />
          ) : (
            <BountyBoard bounties={bounties} onSelectBounty={setSelectedBounty} />
          )}
        </div>
        <div className="hidden w-[300px] flex-shrink-0 xl:block">
          <ClaimFeed />
        </div>
      </div>

      <CallYourShot
        bounty={selectedBounty}
        isOpen={selectedBounty !== null}
        onClose={() => setSelectedBounty(null)}
      />
    </div>
  );
}

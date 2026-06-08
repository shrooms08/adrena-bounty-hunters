"use client";

import { useState } from "react";
import { clsx } from "clsx";
import { BountyCard } from "@/components/bounty/BountyCard";
import type { ClaimDetails } from "@/hooks/useEligibleBounties";
import { bountyRowToView } from "@/types";
import type { BountyRow, BountyView } from "@/types";

interface BountyBoardProps {
  bounties: BountyRow[];
  onClaim?: (
    bounty: BountyView,
    claimDetails?: ClaimDetails,
  ) => void | Promise<void>;
  eligibleBountyIds?: Set<string>;
  claimMap?: Record<string, ClaimDetails>;
}

type Tab = "active" | "claimed";

export function BountyBoard({
  bounties,
  onClaim,
  eligibleBountyIds,
  claimMap,
}: BountyBoardProps) {
  const [tab, setTab] = useState<Tab>("active");

  const activeBounties = bounties.filter((b) => b.status === "active");
  const claimedBounties = bounties.filter((b) => b.status === "claimed");
  const visible = tab === "active" ? activeBounties : claimedBounties;

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: "active", label: "Active", count: activeBounties.length },
    { key: "claimed", label: "Claimed", count: claimedBounties.length },
  ];

  return (
    <section className="mb-10">
      <header className="mb-5 mt-8 flex flex-wrap items-end justify-between gap-4 px-4 lg:mt-10 lg:px-0">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="font-heading text-2xl font-bold text-white">
              Bounty Board
            </h2>
            {activeBounties.length > 0 && (
              <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-bold tabular-nums text-emerald-400">
                {activeBounties.length} live
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

      <div className="mb-5 px-4 lg:px-0">
        <div className="inline-flex gap-1 rounded-xl border border-white/[0.06] bg-[#1a1735] p-1">
          {tabs.map((t) => {
            const selected = tab === t.key;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={clsx(
                  "rounded-lg px-4 py-1.5 font-heading text-xs font-semibold transition-colors",
                  selected
                    ? "bg-emerald-500/15 text-emerald-400"
                    : "text-gray-500 hover:text-gray-300",
                )}
              >
                {t.label}
                <span className="ml-1.5 tabular-nums opacity-70">{t.count}</span>
              </button>
            );
          })}
        </div>
      </div>

      {visible.length === 0 ? (
        <p className="px-4 py-12 text-center text-sm text-gray-500 lg:px-0">
          {tab === "active"
            ? "No active bounties right now — check back soon."
            : "No bounties claimed yet — be the first."}
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 px-4 lg:px-0 md:grid-cols-2 lg:grid-cols-3">
          {visible.map((row) => (
            <BountyCard
              key={row.id}
              bounty={bountyRowToView(row)}
              onClaim={onClaim}
              qualifies={eligibleBountyIds?.has(row.id) ?? false}
              claimDetails={claimMap?.[row.id]}
            />
          ))}
        </div>
      )}
    </section>
  );
}

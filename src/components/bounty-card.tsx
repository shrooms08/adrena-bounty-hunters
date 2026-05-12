"use client";

import type { KeyboardEvent } from "react";
import { CountdownTimer } from "@/components/countdown-timer";
import { TIER_VISUAL } from "@/components/tier-visuals";
import type { BountyRow } from "@/types";
import { TIER_CONFIG } from "@/types";

interface BountyCardProps {
  bounty: BountyRow;
  onSelectBounty?: (bounty: BountyRow) => void;
}

function buildConditionPills(bounty: BountyRow): string[] {
  const pills: string[] = [bounty.asset];

  if (bounty.direction) {
    pills.push(bounty.direction);
  } else {
    pills.push("ANY");
  }

  if (bounty.min_leverage !== null) {
    pills.push(`${bounty.min_leverage}x+`);
  } else if (bounty.max_leverage !== null) {
    pills.push(`≤${bounty.max_leverage}x`);
  }

  if (bounty.max_duration_minutes !== null) {
    pills.push(`≤${bounty.max_duration_minutes}min`);
  }

  if (bounty.min_pnl_percent !== null && bounty.max_pnl_percent !== null) {
    pills.push(`${bounty.min_pnl_percent}–${bounty.max_pnl_percent}%`);
  } else if (bounty.min_pnl_percent !== null) {
    pills.push(`${bounty.min_pnl_percent}%+`);
  } else if (bounty.max_pnl_percent !== null) {
    pills.push(`≤${bounty.max_pnl_percent}%`);
  }

  return pills;
}

export function BountyCard({ bounty, onSelectBounty }: BountyCardProps) {
  const tier = TIER_CONFIG[bounty.tier];
  const visual = TIER_VISUAL[bounty.tier];
  const isClaimed = bounty.status === "claimed";
  const isExpired = bounty.status === "expired";
  const isActive = bounty.status === "active";
  const pills = buildConditionPills(bounty);

  const openModal = () => {
    if (isActive) onSelectBounty?.(bounty);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    if (!isActive) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      openModal();
    }
  };

  return (
    <article
      className={`
        rounded-2xl border border-white/[0.06] bg-[#1a1735] p-6
        transition-colors duration-150
        ${isExpired ? "opacity-40" : ""}
        ${isClaimed ? "opacity-70" : ""}
        ${isActive ? "cursor-pointer hover:border-white/[0.1] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500/40" : ""}
      `}
      onClick={isActive ? openModal : undefined}
      onKeyDown={handleKeyDown}
      role={isActive ? "button" : undefined}
      tabIndex={isActive ? 0 : undefined}
      aria-disabled={!isActive}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className="rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
            style={{
              borderColor: `${visual.color}30`,
              color: visual.color,
              backgroundColor: `${visual.color}12`,
            }}
          >
            {tier.label}
          </span>
          {isActive && (
            <span className="flex items-center gap-1 rounded-md border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse-glow" />
              Live
            </span>
          )}
          {isClaimed && (
            <span className="rounded-md border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-400">
              Claimed
            </span>
          )}
          {isExpired && (
            <span className="rounded-md border border-red-500/20 bg-red-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-red-400">
              Expired
            </span>
          )}
        </div>
        <span className="shrink-0 tabular-nums font-mono text-xs text-gray-500">
          <CountdownTimer targetIso={bounty.expires_at} />
        </span>
      </div>

      {/* Title & description */}
      <div className="mt-4">
        <h3 className="font-heading text-lg font-bold leading-snug text-white">
          {bounty.title}
        </h3>
        <p className="mt-1.5 text-sm leading-relaxed text-gray-500">
          {bounty.description}
        </p>
      </div>

      {/* Condition pills */}
      <div className="mt-4 flex flex-wrap gap-2">
        {pills.map((text, idx) => (
          <span
            key={`${text}-${idx}`}
            className="rounded-lg border border-white/[0.06] bg-[#211e40] px-3 py-1 text-[11px] font-medium uppercase tracking-wide text-gray-400"
          >
            {text}
          </span>
        ))}
      </div>

      {/* Footer */}
      <div className="mt-5 flex items-center justify-between border-t border-white/[0.06] pt-4">
        <span
          className="font-heading text-sm font-bold tabular-nums"
          style={{ color: visual.color }}
        >
          {bounty.reward_points} pts
        </span>
        {isActive && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              openModal();
            }}
            className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-4 py-1.5 text-[12px] font-semibold text-emerald-400 transition-colors hover:border-emerald-500/30 hover:bg-emerald-500/15"
          >
            Hunt this →
          </button>
        )}
      </div>
    </article>
  );
}

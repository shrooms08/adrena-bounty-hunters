"use client";

import { motion } from "framer-motion";
import { Star } from "lucide-react";
import { CountdownTimer } from "@/components/countdown-timer";
import type { Bounty, TradingAsset } from "@/types";
import { TIER_CONFIG } from "@/types";

interface BountyCardProps {
  bounty: Bounty;
  onSelect?: (bounty: Bounty) => void;
}

const ASSET_COLORS: Record<TradingAsset, string> = {
  SOL: "#00d4ff",
  BTC: "#f7931a",
  BONK: "#f5a623",
};

const GLOW: Record<string, string> = {
  common: "0 0 20px rgba(34,197,94,0.08)",
  rare: "0 0 20px rgba(168,85,247,0.12)",
  legendary: "0 0 25px rgba(255,215,0,0.15)",
};

const GLOW_HOVER: Record<string, string> = {
  common: "0 0 20px rgba(34,197,94,0.16)",
  rare: "0 0 20px rgba(168,85,247,0.24)",
  legendary: "0 0 25px rgba(255,215,0,0.30)",
};

function buildConditionPills(bounty: Bounty): { text: string; isAsset: boolean }[] {
  const pills: { text: string; isAsset: boolean }[] = [{ text: bounty.asset, isAsset: true }];

  if (bounty.direction) {
    pills.push({ text: bounty.direction, isAsset: false });
  } else {
    pills.push({ text: "ANY", isAsset: false });
  }

  if (bounty.min_leverage !== null) {
    pills.push({ text: `${bounty.min_leverage}x+`, isAsset: false });
  } else if (bounty.max_leverage !== null) {
    pills.push({ text: `≤${bounty.max_leverage}x`, isAsset: false });
  }

  if (bounty.max_duration_minutes !== null) {
    pills.push({ text: `≤${bounty.max_duration_minutes}min`, isAsset: false });
  }

  if (bounty.min_pnl_percent !== null && bounty.max_pnl_percent !== null) {
    pills.push({ text: `${bounty.min_pnl_percent}–${bounty.max_pnl_percent}%`, isAsset: false });
  } else if (bounty.min_pnl_percent !== null) {
    pills.push({ text: `${bounty.min_pnl_percent}%+`, isAsset: false });
  } else if (bounty.max_pnl_percent !== null) {
    pills.push({ text: `≤${bounty.max_pnl_percent}%`, isAsset: false });
  }

  return pills;
}

export function BountyCard({ bounty, onSelect }: BountyCardProps) {
  const tier = TIER_CONFIG[bounty.tier];
  const isClaimed = bounty.status === "claimed";
  const isExpired = bounty.status === "expired";
  const isActive = bounty.status === "active";
  const assetIcon = bounty.asset === "SOL" ? "◎" : bounty.asset === "BTC" ? "₿" : "🐕";
  const pills = buildConditionPills(bounty);
  const assetBg =
    bounty.asset === "SOL"
      ? "rgba(0, 212, 255, 0.08)"
      : bounty.asset === "BTC"
        ? "rgba(247, 147, 26, 0.08)"
        : "rgba(245, 166, 35, 0.08)";

  return (
    <div
      onClick={() => isActive && onSelect?.(bounty)}
      className="group relative overflow-hidden rounded-xl border border-white/[0.06] bg-[#0f0f14] p-4 transition-all duration-300 hover:-translate-y-[3px]"
      style={{
        boxShadow: isActive ? GLOW[bounty.tier] : "none",
        opacity: isExpired ? 0.3 : isClaimed ? 0.5 : 1,
        cursor: isActive ? "pointer" : "default",
      }}
      onMouseEnter={(e) => {
        if (isActive) e.currentTarget.style.boxShadow = GLOW_HOVER[bounty.tier];
      }}
      onMouseLeave={(e) => {
        if (isActive) e.currentTarget.style.boxShadow = GLOW[bounty.tier];
      }}
    >
      {/* Tier accent line — 3px */}
      <div
        className="absolute inset-x-0 top-0 h-[3px]"
        style={{ backgroundColor: tier.color }}
      />

      {/* CLAIMED stamp */}
      {isClaimed && (
        <motion.div
          initial={{ scale: 3, rotate: -15, opacity: 0 }}
          animate={{ scale: 1, rotate: -12, opacity: 1 }}
          transition={{ duration: 0.55, ease: [0.175, 0.885, 0.32, 1.275] }}
          className="pointer-events-none absolute inset-0 z-10 grid place-items-center"
        >
          <span className="border border-emerald-500/20 bg-emerald-500/10 px-4 py-1 font-mono text-sm font-bold uppercase tracking-widest text-emerald-500/60">
            CLAIMED
          </span>
        </motion.div>
      )}

      {/* EXPIRED stamp */}
      {isExpired && (
        <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center">
          <span className="rotate-[-12deg] border border-red-500/[0.15] px-4 py-1 font-mono text-sm uppercase tracking-widest text-red-500/30">
            EXPIRED
          </span>
        </div>
      )}

      {/* ROW 1: tier badge + countdown */}
      <div className="flex items-center justify-between gap-3">
        <span
          className="inline-flex items-center rounded-md border px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-wider"
          style={{
            color: tier.color,
            backgroundColor: `${tier.color}14`,
            borderColor: `${tier.color}33`,
          }}
        >
          {bounty.tier}
        </span>
        <span className="inline-flex shrink-0 items-center gap-1.5 font-mono text-xs text-slate-500">
          <span
            className="inline-block h-1.5 w-1.5 animate-pulse rounded-full"
            style={{ backgroundColor: tier.color }}
          />
          <CountdownTimer targetIso={bounty.expires_at} />
        </span>
      </div>

      {/* ROW 2: Asset icon + title */}
      <div className="mt-3 flex items-start gap-3">
        <div
          className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-base"
          style={{ backgroundColor: assetBg }}
        >
          {assetIcon}
        </div>
        <div className="min-w-0">
          <p
            className="truncate font-mono text-sm font-semibold text-white"
            title={bounty.title}
          >
            {bounty.title}
          </p>
          <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">
            {bounty.description}
          </p>
        </div>
      </div>

      {/* ROW 3: Condition pills */}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {pills.map((pill, idx) => (
          <span
            key={`${pill.text}-${idx}`}
            className="rounded-md border border-white/[0.06] bg-white/[0.03] px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-slate-400"
          >
            {pill.text}
          </span>
        ))}
      </div>

      {/* ROW 4: Points + hunt CTA */}
      <div className="mt-3 flex items-center justify-between border-t border-white/[0.04] pt-3">
        <span className="inline-flex items-center gap-1.5 font-mono text-sm" style={{ color: tier.color }}>
          <Star size={13} className="text-[#ffd700]" />
          {bounty.reward_points} pts
        </span>
        <span className="font-mono text-[11px] text-slate-600 transition-colors group-hover:text-slate-300">
          Hunt this →
        </span>
      </div>
    </div>
  );
}

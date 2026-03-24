"use client";

import { motion, AnimatePresence } from "framer-motion";
import type { Bounty } from "@/types";
import { tierColorMap } from "@/lib/bounty-data";

interface CallYourShotProps {
  bounty: Bounty | null;
  isOpen: boolean;
  onClose: () => void;
}

export function CallYourShot({ bounty, isOpen, onClose }: CallYourShotProps) {
  if (!bounty) return null;

  const tierColor = tierColorMap[bounty.tier];

  function handleCallShot() {
    console.log("CALL YOUR SHOT:", {
      bountyId: bounty!.id,
      title: bounty!.title,
      asset: bounty!.asset,
      direction: bounty!.direction ?? "ANY",
      minPnl: bounty!.min_pnl_percent,
      maxPnl: bounty!.max_pnl_percent,
      tier: bounty!.tier,
      rewardPoints: bounty!.reward_points,
    });
    onClose();
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="relative max-w-md mx-auto rounded-2xl border border-white/10 bg-[#13131a] p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="absolute inset-x-0 top-0 h-0.5 rounded-t-2xl"
              style={{ backgroundColor: tierColor }}
            />

            <div className="mb-4">
              <p
                className="mb-1 inline-block rounded-full px-2 py-0.5 text-[10px] uppercase tracking-[0.16em]"
                style={{
                  color: tierColor,
                  backgroundColor: `color-mix(in oklab, ${tierColor} 16%, transparent)`,
                }}
              >
                {bounty.tier}
              </p>
              <h3 className="font-heading text-lg text-[var(--text-primary)]">
                {bounty.title}
              </h3>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">
                {bounty.description}
              </p>
            </div>

            <p className="mb-3 font-heading text-sm uppercase tracking-[0.12em] text-[var(--accent)]">
              I&apos;m calling it
            </p>

            <div className="mb-5 flex flex-wrap gap-2">
              <ConditionChip label="Asset" value={bounty.asset} />
              <ConditionChip
                label="Direction"
                value={bounty.direction ?? "ANY"}
              />
              {bounty.min_pnl_percent !== null && (
                <ConditionChip
                  label="Target PnL"
                  value={
                    bounty.max_pnl_percent !== null
                      ? `${bounty.min_pnl_percent}–${bounty.max_pnl_percent}%`
                      : `${bounty.min_pnl_percent}%+`
                  }
                />
              )}
              {bounty.min_leverage !== null && (
                <ConditionChip
                  label="Leverage"
                  value={`${bounty.min_leverage}x+`}
                />
              )}
              {bounty.max_duration_minutes !== null && (
                <ConditionChip
                  label="Time Limit"
                  value={`${bounty.max_duration_minutes}min`}
                />
              )}
            </div>

            <button
              onClick={handleCallShot}
              className="w-full rounded-xl bg-[var(--accent)] py-3 font-heading text-sm font-bold uppercase tracking-[0.16em] text-black transition-opacity hover:opacity-90"
            >
              CALL MY SHOT
            </button>

            <p className="mt-3 text-center text-xs text-slate-500">
              Your prediction is public. Win = glory. Lose = shame.
            </p>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

function ConditionChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5">
      <p className="text-[10px] uppercase tracking-wider text-[var(--text-secondary)]">
        {label}
      </p>
      <p className="font-mono text-sm text-[var(--text-primary)]">{value}</p>
    </div>
  );
}

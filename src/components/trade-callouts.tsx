"use client";

import { motion } from "framer-motion";
import { Megaphone } from "lucide-react";
import { formatClock } from "@/lib/format";
import type { TradeCallout } from "@/types/bounty";

interface TradeCalloutsProps {
  callouts: TradeCallout[];
}

export function TradeCallouts({ callouts }: TradeCalloutsProps) {
  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
      <div className="mb-4 flex items-center gap-2 text-[var(--text-primary)]">
        <Megaphone size={16} className="text-[var(--accent)]" />
        <h3 className="font-heading text-lg">Trade Callouts</h3>
      </div>
      <div className="space-y-3">
        {callouts.map((callout, idx) => (
          <motion.div
            key={callout.id}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: idx * 0.08 }}
            className="rounded-xl border border-[var(--border)] bg-black/20 p-3"
          >
            <div className="mb-2 flex items-center justify-between text-xs">
              <p className="font-mono text-[var(--text-primary)]">@{callout.trader}</p>
              <p className="text-[var(--text-secondary)]">
                {formatClock(callout.createdAt)}
              </p>
            </div>
            <p className="mb-2 text-xs text-[var(--accent)]">
              {callout.asset} {callout.direction} | {callout.leverage}x
            </p>
            <p className="text-sm text-[var(--text-secondary)]">{callout.thesis}</p>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

"use client";

import { motion } from "framer-motion";
import { Activity, BadgeCheck, CandlestickChart } from "lucide-react";
import { formatClock } from "@/lib/format";
import type { LiveFeedItem } from "@/types/bounty";

interface LiveFeedProps {
  entries: LiveFeedItem[];
}

export function LiveFeed({ entries }: LiveFeedProps) {
  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
      <div className="mb-4 flex items-center gap-2 text-[var(--text-primary)]">
        <Activity size={16} className="text-[var(--accent)]" />
        <h3 className="font-heading text-lg">Live Feed</h3>
      </div>
      <div className="space-y-2">
        {entries.map((entry, idx) => (
          <motion.div
            key={entry.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.06 }}
            className="flex items-start justify-between gap-3 rounded-xl border border-[var(--border)] bg-black/20 p-3"
          >
            <div className="flex items-start gap-2">
              {entry.type === "claim" ? (
                <BadgeCheck size={15} className="mt-0.5 text-[var(--success)]" />
              ) : (
                <CandlestickChart size={15} className="mt-0.5 text-[var(--accent)]" />
              )}
              <p className="text-sm text-[var(--text-secondary)]">
                <span className="font-mono text-[var(--text-primary)]">{entry.trader}</span>{" "}
                {entry.content}
              </p>
            </div>
            <span className="whitespace-nowrap text-xs text-[var(--text-secondary)]">
              {formatClock(entry.timestamp)}
            </span>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

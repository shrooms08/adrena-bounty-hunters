"use client";

import { motion } from "framer-motion";
import { BadgeCheck } from "lucide-react";
import { formatClock } from "@/lib/format";
import type { LiveFeedItem } from "@/types/bounty";

interface ClaimFeedProps {
  entries: LiveFeedItem[];
}

export function ClaimFeed({ entries }: ClaimFeedProps) {
  const claims = entries.filter((entry) => entry.type === "claim");

  return (
    <aside className="max-h-[calc(100vh-7rem)] overflow-y-auto rounded-xl border border-white/[0.06] bg-[#13131a] p-4">
      <div className="mb-3 flex items-center gap-2">
        <BadgeCheck size={15} className="text-[#22c55e]" />
        <h3 className="font-heading text-base text-[var(--text-primary)]">Claim Feed</h3>
      </div>
      <div className="space-y-2">
        {claims.map((entry, idx) => (
          <motion.article
            key={entry.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.06 }}
            className="rounded-lg border border-white/[0.06] bg-black/20 p-2.5"
          >
            <p className="text-xs text-[var(--text-secondary)]">
              <span className="font-mono text-[var(--text-primary)]">{entry.trader}</span>{" "}
              {entry.content}
            </p>
            <p className="mt-1 text-[10px] text-[var(--text-secondary)]">
              {formatClock(entry.timestamp)}
            </p>
          </motion.article>
        ))}
      </div>
    </aside>
  );
}

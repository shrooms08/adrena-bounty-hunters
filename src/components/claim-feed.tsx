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
    <aside className="max-h-[calc(100vh-7rem)] overflow-y-auto rounded-2xl border border-white/[0.06] bg-[#1a1735] p-4">
      <div className="mb-3 flex items-center gap-2">
        <BadgeCheck size={15} className="text-emerald-400" />
        <h3 className="font-heading text-base text-white">Claim Feed</h3>
      </div>
      <div className="space-y-2">
        {claims.map((entry, idx) => (
          <motion.article
            key={entry.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.06 }}
            className="rounded-lg border border-white/[0.06] bg-[#0c0a1d] p-2.5"
          >
            <p className="text-xs text-gray-500">
              <span className="font-mono text-white">{entry.trader}</span>{" "}
              {entry.content}
            </p>
            <p className="mt-1 text-[10px] text-gray-600">
              {formatClock(entry.timestamp)}
            </p>
          </motion.article>
        ))}
      </div>
    </aside>
  );
}

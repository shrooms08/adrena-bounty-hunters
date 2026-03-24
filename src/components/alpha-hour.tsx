"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import type { AlphaTrader } from "@/types/bounty";

interface AlphaHourProps {
  trader: AlphaTrader;
}

export function AlphaHour({ trader }: AlphaHourProps) {
  const [livePnl, setLivePnl] = useState<number>(trader.pnlPercent);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setLivePnl((prev) => {
        const drift = (Math.random() - 0.45) * 0.24;
        return Math.max(0, Number((prev + drift).toFixed(2)));
      });
    }, 2000);

    return () => window.clearInterval(timer);
  }, []);

  return (
    <motion.section
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="mb-8 flex items-center justify-between rounded-2xl border border-amber-500/20 p-5"
      style={{
        background:
          "linear-gradient(to right, rgba(245,158,11,0.04), transparent)",
      }}
    >
      {/* Left */}
      <div className="min-w-0">
        <div className="mb-1.5 flex items-center gap-2">
          <span className="text-base" aria-hidden="true">
            👑
          </span>
          <span className="font-mono text-[11px] font-bold uppercase tracking-widest text-amber-400/80">
            Alpha of the Hour
          </span>
        </div>
        <p className="text-lg font-bold text-white">@{trader.handle}</p>
        <p className="mt-0.5 text-sm text-slate-500">
          {trader.asset} {trader.direction} · {trader.leverage}x leverage
        </p>
      </div>

      {/* Right: P&L */}
      <div className="flex shrink-0 items-center gap-3">
        <motion.p
          key={livePnl}
          initial={{ opacity: 0.6, y: 2 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="font-mono text-4xl font-bold text-emerald-400"
          style={{ textShadow: "0 0 30px rgba(52,211,153,0.3)" }}
        >
          +{livePnl.toFixed(2)}%
        </motion.p>
        <span className="inline-flex items-center gap-1 rounded-md border border-red-500/20 bg-red-500/8 px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase text-red-400">
          <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-red-400" />
          Live
        </span>
      </div>
    </motion.section>
  );
}

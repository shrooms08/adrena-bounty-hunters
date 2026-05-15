"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Radio } from "lucide-react";
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
    <section className="mx-4 mt-6 rounded-2xl border border-white/[0.06] bg-[#1a1735] p-6 lg:mx-0 lg:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/[0.06] bg-[#211e40] font-heading text-sm font-bold text-gray-300">
            {trader.handle.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-gray-500">
                Alpha of the hour
              </p>
              <span className="flex items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-emerald-400">
                <Radio className="h-2.5 w-2.5 animate-pulse-glow" />
                Live
              </span>
            </div>
            <p className="mt-1 font-heading text-base font-bold text-white">
              @{trader.handle}
            </p>
            <p className="mt-0.5 text-sm text-gray-500">
              {trader.asset} {trader.direction} · {trader.leverage}× leverage
            </p>
          </div>
        </div>

        <motion.p
          key={livePnl}
          initial={{ opacity: 0.8 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2 }}
          className="tabular-nums font-heading text-4xl font-bold tracking-tight text-emerald-400"
        >
          +{livePnl.toFixed(2)}%
        </motion.p>
      </div>
    </section>
  );
}

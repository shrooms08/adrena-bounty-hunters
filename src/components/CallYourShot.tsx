"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useWallet } from "@solana/wallet-adapter-react";
import { X, CheckCircle2 } from "lucide-react";
import { TIER_VISUAL } from "@/components/tier-visuals";
import type { BountyRow } from "@/types";

interface CallYourShotProps {
  bounty: BountyRow;
  isOpen: boolean;
  onClose: () => void;
  onClaimed?: () => void;
}

export function CallYourShot({
  bounty,
  isOpen,
  onClose,
  onClaimed,
}: CallYourShotProps) {
  const { publicKey } = useWallet();
  const [txSignature, setTxSignature] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">(
    "idle",
  );
  const [message, setMessage] = useState("");

  if (!isOpen) return null;

  const visual = TIER_VISUAL[bounty.tier];

  async function handleClaim() {
    if (!publicKey) {
      setStatus("error");
      setMessage("Connect wallet first");
      return;
    }

    if (!txSignature.trim()) {
      setStatus("error");
      setMessage("Enter transaction signature");
      return;
    }

    setStatus("loading");
    setMessage("");

    try {
      const res = await fetch("/api/bounties/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bounty_id: bounty.id,
          wallet: publicKey.toBase58(),
          trade_tx: txSignature.trim(),
        }),
      });

      let json: { error?: string; message?: string } = {};
      try {
        json = (await res.json()) as { error?: string; message?: string };
      } catch {
        setStatus("error");
        setMessage("Invalid response from server");
        return;
      }

      if (!res.ok) {
        setStatus("error");
        setMessage(json.error ?? json.message ?? "Claim failed");
        return;
      }

      setStatus("success");
      setMessage(`Claimed! +${bounty.reward_points} points`);
      onClaimed?.();

      window.setTimeout(() => {
        onClose();
        setStatus("idle");
        setTxSignature("");
        setMessage("");
      }, 1200);
    } catch {
      setStatus("error");
      setMessage("Network error — try again");
    }
  }

  const pnlDisplay =
    bounty.min_pnl_percent !== null && bounty.max_pnl_percent !== null
      ? `${bounty.min_pnl_percent}–${bounty.max_pnl_percent}%`
      : bounty.min_pnl_percent !== null
        ? `${bounty.min_pnl_percent}%+`
        : bounty.max_pnl_percent !== null
          ? `≤${bounty.max_pnl_percent}%`
          : "Any";

  const leverageDisplay =
    bounty.min_leverage !== null
      ? `${bounty.min_leverage}x+`
      : bounty.max_leverage !== null
        ? `≤${bounty.max_leverage}x`
        : "Any";

  const timeLimitDisplay =
    bounty.max_duration_minutes !== null
      ? `${bounty.max_duration_minutes} min`
      : "Any";

  const directionDisplay = bounty.direction ?? "Any";

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />

      <div
        className="fixed left-1/2 top-1/2 z-[51] w-full max-w-md -translate-x-1/2 -translate-y-1/2 px-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="call-your-shot-title"
      >
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.97 }}
          transition={{ duration: 0.2 }}
          className="relative rounded-2xl border border-white/[0.06] bg-[#1a1735] p-6"
        >
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 text-gray-500 transition-colors hover:text-white"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>

          <div
            className="absolute inset-x-0 top-0 h-[2px] rounded-t-2xl"
            style={{ backgroundColor: visual.color }}
          />

          <h2
            id="call-your-shot-title"
            className="mb-4 font-heading text-lg font-bold text-white"
          >
            Hunt This BountyRow
          </h2>

          <div className="mb-4">
            <p className="font-heading text-sm font-semibold text-white">
              {bounty.title}
            </p>
            <p className="mt-0.5 text-xs text-gray-500">
              {bounty.description}
            </p>
          </div>

          <div className="mb-4 space-y-2">
            <ConditionRow label="Asset" value={bounty.asset} />
            <ConditionRow label="Direction" value={directionDisplay} />
            <ConditionRow label="Target PnL" value={pnlDisplay} />
            <ConditionRow label="Leverage requirement" value={leverageDisplay} />
            <ConditionRow label="Time limit" value={timeLimitDisplay} />
          </div>

          <div className="mb-4 rounded-xl border border-white/[0.06] bg-[#0c0a1d] p-3">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
              How to claim
            </p>
            <div className="space-y-1 text-xs text-gray-500">
              <p>1. Open this trade on Adrena</p>
              <p>2. Meet the bounty conditions</p>
              <p>3. Come back and submit your transaction signature</p>
            </div>
          </div>

          <input
            type="text"
            value={txSignature}
            onChange={(e) => {
              setTxSignature(e.target.value);
              if (status === "error") {
                setStatus("idle");
                setMessage("");
              }
            }}
            placeholder="Paste your trade tx signature..."
            className="mb-3 w-full rounded-xl border border-white/[0.06] bg-[#0c0a1d] px-4 py-3 font-mono text-sm text-white placeholder-gray-600 outline-none transition-colors focus:border-emerald-500/30"
          />

          {message && (
            <div
              className={`mb-3 flex items-center justify-center gap-1.5 text-center text-xs font-medium ${
                status === "success" ? "text-emerald-400" : "text-red-400"
              }`}
            >
              {status === "success" && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 400, damping: 15 }}
                >
                  <CheckCircle2 className="h-4 w-4" />
                </motion.div>
              )}
              {message}
            </div>
          )}

          <button
            type="button"
            onClick={handleClaim}
            disabled={status === "loading" || status === "success"}
            className="w-full rounded-xl bg-emerald-500 py-3 font-heading font-bold text-black transition-colors hover:bg-emerald-400 disabled:opacity-50"
          >
            {status === "loading" ? "Claiming..." : "CLAIM BOUNTY"}
          </button>

          <a
            href="https://app.adrena.xyz"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 block text-center text-xs text-emerald-400/80 transition-colors hover:text-emerald-400"
          >
            Open Adrena to Trade →
          </a>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

function ConditionRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-lg border border-white/[0.06] bg-[#0c0a1d] px-3 py-2">
      <p className="text-[10px] uppercase tracking-wider text-gray-500">
        {label}
      </p>
      <p className="text-right font-mono text-sm text-white">{value}</p>
    </div>
  );
}

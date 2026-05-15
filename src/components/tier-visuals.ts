import type { BountyTier } from "@/types";

export const TIER_VISUAL: Record<
  BountyTier,
  {
    color: string;
    glow: string;
    borderGlow: string;
    bg: string;
  }
> = {
  common: {
    color: "#22c55e",
    glow: "0 0 12px rgba(34, 197, 94, 0.1)",
    borderGlow: "rgba(34, 197, 94, 0.2)",
    bg: "rgba(34, 197, 94, 0.08)",
  },
  rare: {
    color: "#a855f7",
    glow: "0 0 12px rgba(168, 85, 247, 0.1)",
    borderGlow: "rgba(168, 85, 247, 0.2)",
    bg: "rgba(168, 85, 247, 0.08)",
  },
  legendary: {
    color: "#ffd700",
    glow: "0 0 16px rgba(255, 215, 0, 0.12)",
    borderGlow: "rgba(255, 215, 0, 0.25)",
    bg: "rgba(255, 215, 0, 0.08)",
  },
};

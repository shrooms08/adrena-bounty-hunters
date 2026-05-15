"use client";

import { clsx } from "clsx";
import { useEffect, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import type { BountySide, BountyTier, BountyView } from "@/types";

interface BountyCardProps {
  bounty: BountyView;
  onClaim?: (bounty: BountyView) => void;
}

interface Countdown {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  totalSeconds: number;
  expired: boolean;
}

function computeCountdown(targetIso: string): Countdown {
  const targetMs = new Date(targetIso).getTime();
  const nowMs = Date.now();
  const diffMs = targetMs - nowMs;
  if (diffMs <= 0) {
    return {
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
      totalSeconds: 0,
      expired: true,
    };
  }
  const totalSeconds = Math.floor(diffMs / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return { days, hours, minutes, seconds, totalSeconds, expired: false };
}

function useCountdown(targetIso: string): Countdown | null {
  const [countdown, setCountdown] = useState<Countdown | null>(null);
  useEffect(() => {
    const tick = () => setCountdown(computeCountdown(targetIso));
    const raf = requestAnimationFrame(tick);
    const id = setInterval(tick, 1000);
    return () => {
      cancelAnimationFrame(raf);
      clearInterval(id);
    };
  }, [targetIso]);
  return countdown;
}

function formatCountdown(c: Countdown): string {
  if (c.expired) return "Expired";
  if (c.days > 0) return `${c.days}d ${c.hours}h`;
  if (c.hours > 0) return `${c.hours}h ${c.minutes}m`;
  return `${c.minutes}m ${String(c.seconds).padStart(2, "0")}s`;
}

function truncateWallet(addr: string): string {
  if (addr.length <= 10) return addr;
  return `${addr.slice(0, 4)}...${addr.slice(-4)}`;
}

function timeAgo(iso: string): string {
  const diffSec = Math.max(
    0,
    Math.floor((Date.now() - new Date(iso).getTime()) / 1000),
  );
  if (diffSec < 60) return `${diffSec}s ago`;
  const min = Math.floor(diffSec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const days = Math.floor(hr / 24);
  return `${days}d ago`;
}

const TIER_CLASSES: Record<BountyTier, string> = {
  common: "bg-txtfade/15 text-txtfade",
  rare: "bg-blue-500/15 text-blue-500",
  legendary: "bg-orange-500/15 text-orange-500",
};

const SIDE_CLASSES: Record<BountySide, string> = {
  long: "bg-green-500/15 text-green-500",
  short: "bg-red-500/15 text-red-500",
  any: "bg-txtfade/15 text-txtfade",
};

function Pill({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={clsx(
        "rounded-full px-2 py-0.5 text-xs uppercase tracking-wide font-mono",
        className,
      )}
    >
      {children}
    </span>
  );
}

function StatCell({
  label,
  value,
  unit,
  valueClassName,
}: {
  label: string;
  value: React.ReactNode;
  unit?: string;
  valueClassName?: string;
}) {
  return (
    <div className="flex flex-col min-h-[2.75rem] min-w-0">
      <span className="text-xs uppercase text-txtfade tracking-wide">
        {label}
      </span>
      <span
        className={clsx(
          "font-mono text-base text-light whitespace-nowrap",
          valueClassName,
        )}
      >
        {value}
        {unit && (
          <span className="text-xs opacity-70 ml-1">{unit}</span>
        )}
      </span>
    </div>
  );
}

function formatNumber(amount: number): string {
  return amount.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

function HuntersValue({ count }: { count: number }) {
  if (count === 0) {
    return <span className="text-txtfade">0 racing</span>;
  }
  return (
    <span className="text-redbright animate-pulse">
      {count === 1 ? "1 racing" : `${count} racing`}
    </span>
  );
}

function CountdownLabel({ targetIso }: { targetIso: string }) {
  const c = useCountdown(targetIso);
  if (!c) {
    return <span className="font-mono text-sm text-txtfade">—</span>;
  }
  const urgent = !c.expired && c.totalSeconds < 3600;
  const critical = !c.expired && c.totalSeconds < 60;
  return (
    <span
      className={clsx(
        "font-mono text-sm",
        c.expired && "text-txtfade",
        !c.expired && !urgent && "text-txtfade",
        urgent && "text-redbright",
        critical && "animate-pulse",
      )}
    >
      {c.expired ? "Expired" : `${formatCountdown(c)} left`}
    </span>
  );
}

export function BountyCard({ bounty, onClaim }: BountyCardProps) {
  const { publicKey } = useWallet();
  const { setVisible: setWalletModalVisible } = useWalletModal();
  const isWalletConnected = publicKey !== null;
  const isClaimed = bounty.state === "claimed";
  const isExpired = bounty.state === "expired";
  const cardVariant =
    isClaimed || isExpired ? ("disabled" as const) : ("default" as const);

  const stats: Array<{
    label: string;
    value: React.ReactNode;
    unit?: string;
    key: string;
  }> = [];

  if (isClaimed && bounty.claimedAt) {
    stats.push({
      key: "claimedAt",
      label: "Claimed",
      value: timeAgo(bounty.claimedAt),
    });
  } else {
    stats.push({
      key: "reward",
      label: "Reward",
      value: formatNumber(bounty.rewardPoints),
      unit: "pts",
    });
  }

  if (!isClaimed && bounty.minCollateralUsd !== undefined) {
    stats.push({
      key: "minColl",
      label: "Min Coll",
      value: `$${formatNumber(bounty.minCollateralUsd)}`,
    });
  }

  if (!isClaimed && bounty.minLeverage !== undefined) {
    stats.push({
      key: "minLev",
      label: "Min Lev",
      value: `${bounty.minLeverage}`,
      unit: "x",
    });
  }

  if (!isClaimed && bounty.minPnlPercent !== undefined) {
    stats.push({
      key: "minPnl",
      label: "Min PnL",
      value: `${bounty.minPnlPercent}`,
      unit: "%",
    });
  }

  if (!isClaimed && bounty.maxDurationMinutes !== undefined) {
    stats.push({
      key: "maxDur",
      label: "Max Dur",
      value: `${bounty.maxDurationMinutes}`,
      unit: "min",
    });
  }

  if (isClaimed && bounty.claimedBy) {
    stats.push({
      key: "claimedBy",
      label: "Claimed by",
      value: (
        <span className="font-mono text-light">
          {truncateWallet(bounty.claimedBy)}
        </span>
      ),
    });
  } else {
    stats.push({
      key: "hunters",
      label: "Hunters",
      value: <HuntersValue count={bounty.activeHuntersCount} />,
    });
  }

  const visibleStats = stats.slice(0, 4);

  const handleClaim = () => {
    if (!isWalletConnected) {
      setWalletModalVisible(true);
      return;
    }
    onClaim?.(bounty);
  };

  const handleViewClaimer = () => {
    console.log("[BountyCard] view claimer for", bounty.id);
  };

  return (
    <Card as="article" variant={cardVariant} className="flex flex-col h-full">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <Pill className={TIER_CLASSES[bounty.tier]}>{bounty.tier}</Pill>
          <Pill className="bg-light/10 text-light">{bounty.asset}</Pill>
          <span className="text-txtfade text-xs">·</span>
          <Pill className={SIDE_CLASSES[bounty.side]}>{bounty.side}</Pill>
        </div>
        {isExpired ? (
          <span className="font-mono text-sm text-txtfade">Expired</span>
        ) : (
          <CountdownLabel targetIso={bounty.expiresAt} />
        )}
      </div>

      <h3 className="text-light text-lg font-semibold mt-3 mb-1">
        {bounty.title}
      </h3>
      <p className="text-sm text-txtfade leading-relaxed mb-4">
        {bounty.description}
      </p>

      {isExpired ? (
        <p className="text-sm text-txtfade italic mb-4">
          Expired without being claimed.
        </p>
      ) : (
        <div
          className="grid gap-3 mb-4"
          style={{
            gridTemplateColumns: `repeat(${visibleStats.length}, minmax(0, 1fr))`,
          }}
        >
          {visibleStats.map((s) => (
            <StatCell
              key={s.key}
              label={s.label}
              value={s.value}
              unit={s.unit}
            />
          ))}
        </div>
      )}

      <div className="flex-grow" />

      {bounty.state === "active" && (
        <Button variant="execute" fullWidth onClick={handleClaim}>
          {isWalletConnected ? "Claim Bounty" : "Connect Wallet"}
        </Button>
      )}
      {bounty.state === "claimed" && (
        <Button variant="outline" fullWidth onClick={handleViewClaimer}>
          View claimer
        </Button>
      )}
    </Card>
  );
}

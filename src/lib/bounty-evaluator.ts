import type { AdrenaTradeEvent, BountyRow } from "@/types";

interface EvaluationResult {
  matches: boolean;
  reasons: string[];
}

const toMs = (timestamp: number): number =>
  timestamp < 1_000_000_000_000 ? timestamp * 1000 : timestamp;

export function evaluateTrade(
  bounty: BountyRow,
  trade: AdrenaTradeEvent,
): EvaluationResult {
  const reasons: string[] = [];
  let matches = true;

  if (bounty.status === "active") {
    reasons.push("✓ Status: active");
  } else {
    reasons.push(`Status mismatch: bounty is ${bounty.status}`);
    matches = false;
  }

  const nowMs = Date.now();
  const expiresAtMs = new Date(bounty.expires_at).getTime();
  if (expiresAtMs > nowMs) {
    reasons.push("✓ Not expired");
  } else {
    reasons.push("BountyRow expired");
    matches = false;
  }

  const createdAtMs = new Date(bounty.created_at).getTime();
  const openedAtMs = toMs(trade.open_timestamp);
  if (openedAtMs >= createdAtMs) {
    reasons.push("✓ Trade opened after bounty creation");
  } else {
    reasons.push("Trade opened before bounty was created");
    matches = false;
  }

  if (trade.asset === bounty.asset) {
    reasons.push(`✓ Asset: ${trade.asset}`);
  } else {
    reasons.push(`Asset mismatch: expected ${bounty.asset}, got ${trade.asset}`);
    matches = false;
  }

  if (bounty.direction === null || trade.direction === bounty.direction) {
    reasons.push(
      bounty.direction
        ? `✓ Direction: ${trade.direction}`
        : `✓ Direction: any (${trade.direction})`,
    );
  } else {
    reasons.push(
      `Direction mismatch: expected ${bounty.direction}, got ${trade.direction}`,
    );
    matches = false;
  }

  if (bounty.min_pnl_percent !== null && trade.pnl_percent < bounty.min_pnl_percent) {
    reasons.push(
      `PnL too low: ${trade.pnl_percent}% < min ${bounty.min_pnl_percent}%`,
    );
    matches = false;
  } else if (
    bounty.max_pnl_percent !== null &&
    trade.pnl_percent > bounty.max_pnl_percent
  ) {
    reasons.push(
      `PnL too high: ${trade.pnl_percent}% > max ${bounty.max_pnl_percent}%`,
    );
    matches = false;
  } else {
    reasons.push(`✓ PnL: ${trade.pnl_percent}%`);
  }

  if (bounty.min_leverage !== null && trade.leverage < bounty.min_leverage) {
    reasons.push(`Leverage too low: ${trade.leverage}x < min ${bounty.min_leverage}x`);
    matches = false;
  } else if (bounty.max_leverage !== null && trade.leverage > bounty.max_leverage) {
    reasons.push(`Leverage too high: ${trade.leverage}x > max ${bounty.max_leverage}x`);
    matches = false;
  } else {
    reasons.push(`✓ Leverage: ${trade.leverage}x`);
  }

  if (
    bounty.max_duration_minutes !== null &&
    trade.duration_minutes > bounty.max_duration_minutes
  ) {
    reasons.push(
      `Duration too long: ${trade.duration_minutes}m > max ${bounty.max_duration_minutes}m`,
    );
    matches = false;
  } else {
    reasons.push(`✓ Duration: ${trade.duration_minutes}m`);
  }

  if (trade.position_size_usd >= bounty.min_position_size_usd) {
    reasons.push(`✓ Position size: $${trade.position_size_usd}`);
  } else {
    reasons.push(
      `Position size too small: $${trade.position_size_usd} < min $${bounty.min_position_size_usd}`,
    );
    matches = false;
  }

  const durationSeconds = trade.duration_minutes * 60;
  if (durationSeconds < 10 && trade.pnl_percent < 0.5) {
    reasons.push(
      "Rejected by anti-abuse: duration < 10s and PnL < 0.5% (possible wash trade)",
    );
    matches = false;
  } else {
    reasons.push("✓ Anti-abuse check passed");
  }

  return { matches, reasons };
}

export function findMatchingBounties(
  bounties: BountyRow[],
  trade: AdrenaTradeEvent,
): BountyRow[] {
  return bounties
    .filter((bounty) => evaluateTrade(bounty, trade).matches)
    .sort((a, b) => b.reward_points - a.reward_points);
}

export type { EvaluationResult };

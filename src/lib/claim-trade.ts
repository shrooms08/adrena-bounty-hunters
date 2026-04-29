// Shared claim pipeline. Both the manual claim route and the close-watcher
// call this with a pre-composed AdrenaTradeEvent — guarantees identical
// idempotency, race protection, evaluator semantics, and audit trail.
//
// Contract: NEVER throws on expected failure modes. Every failure returns
// a typed { kind } discriminator so callers (HTTP handler, watcher loop)
// can render a response or log + continue without try/catch boilerplate.
// Throws are reserved for genuine bugs — invalid args, missing dependencies.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { AdrenaTradeEvent, Bounty } from "@/types";

export type ClaimSource = "manual" | "auto";

export interface EvaluationResult {
  matches: boolean;
  reasons: string[];
}

export type Evaluator = (
  bounty: Bounty,
  trade: AdrenaTradeEvent,
) => EvaluationResult;

export type ClaimResult =
  | {
      kind: "success";
      claimId: string;
      bountyId: string;
      points: number;
    }
  | { kind: "bounty_not_found"; bountyId: string }
  | { kind: "bounty_inactive"; bountyId: string; status: string }
  | { kind: "bounty_expired"; bountyId: string }
  | { kind: "rate_limited"; wallet: string; claimsInLastHour: number }
  | { kind: "evaluator_rejected"; reasons: string[] }
  | { kind: "race_lost"; bountyId: string }
  | { kind: "duplicate_signature"; existingClaimId: string }
  | { kind: "database_error"; message: string };

export interface ClaimTradeArgs {
  bountyId: string;
  wallet: string;
  source: ClaimSource;
  trade: AdrenaTradeEvent;
  supabase: SupabaseClient;
  evaluator: Evaluator;
}

const RATE_LIMIT_PER_HOUR = 3;

export async function claimTrade(args: ClaimTradeArgs): Promise<ClaimResult> {
  const { bountyId, wallet, source, trade, supabase, evaluator } = args;

  if (!bountyId || !wallet || !source || !trade || !supabase || !evaluator) {
    throw new Error(
      "claimTrade: missing required argument (bountyId, wallet, source, trade, supabase, evaluator are all mandatory)",
    );
  }

  try {
    // ---------------------------------------------------------------------
    // 1. Idempotency — has this signature already claimed something?
    // The DB-level UNIQUE index on claims.trade_tx is the ultimate guard,
    // but we check first to return a useful typed result instead of a
    // generic constraint violation.
    // ---------------------------------------------------------------------
    {
      const { data, error } = await supabase
        .from("claims")
        .select("id")
        .eq("trade_tx", trade.tx_signature)
        .maybeSingle();
      if (error) return dbError("idempotency check", error);
      if (data) {
        return {
          kind: "duplicate_signature",
          existingClaimId: String(data.id),
        };
      }
    }

    // ---------------------------------------------------------------------
    // 2. Bounty lookup + status checks.
    // ---------------------------------------------------------------------
    const { data: bountyRow, error: bountyErr } = await supabase
      .from("bounties")
      .select("*")
      .eq("id", bountyId)
      .maybeSingle();
    if (bountyErr) return dbError("bounty lookup", bountyErr);
    if (!bountyRow) return { kind: "bounty_not_found", bountyId };

    const bounty = bountyRow as Bounty;
    if (bounty.status !== "active") {
      return { kind: "bounty_inactive", bountyId, status: bounty.status };
    }

    const now = new Date();
    const expiresAt = new Date(bounty.expires_at);
    if (expiresAt.getTime() < now.getTime()) {
      return { kind: "bounty_expired", bountyId };
    }

    // ---------------------------------------------------------------------
    // 3. Wallet binding — composed trade's wallet must equal claim wallet.
    // Catches a manual submitter pasting someone else's signature; the
    // auto-watcher path always has trade.wallet === wallet by construction
    // but we verify defensively anyway.
    // ---------------------------------------------------------------------
    if (trade.wallet !== wallet) {
      return {
        kind: "evaluator_rejected",
        reasons: [
          `wallet mismatch: trade owner=${trade.wallet}, claim wallet=${wallet}`,
        ],
      };
    }

    // ---------------------------------------------------------------------
    // 4. Rate limit — N claims per wallet per rolling hour.
    // ---------------------------------------------------------------------
    const oneHourAgoIso = new Date(
      now.getTime() - 60 * 60 * 1000,
    ).toISOString();
    const {
      count,
      error: rlErr,
    } = await supabase
      .from("claims")
      .select("id", { count: "exact", head: true })
      .eq("wallet", wallet)
      .gte("claimed_at", oneHourAgoIso);
    if (rlErr) return dbError("rate limit count", rlErr);
    const claimsInLastHour = count ?? 0;
    if (claimsInLastHour >= RATE_LIMIT_PER_HOUR) {
      return { kind: "rate_limited", wallet, claimsInLastHour };
    }

    // ---------------------------------------------------------------------
    // 5. Evaluator — does this trade satisfy the bounty's conditions?
    // ---------------------------------------------------------------------
    const evalResult = evaluator(bounty, trade);
    if (!evalResult.matches) {
      return { kind: "evaluator_rejected", reasons: evalResult.reasons };
    }

    // ---------------------------------------------------------------------
    // 6. Atomic claim — UPDATE … WHERE status='active'. If 0 rows match,
    // someone else won the race between our read and write.
    // ---------------------------------------------------------------------
    const nowIso = now.toISOString();
    const {
      data: claimedBounty,
      error: claimErr,
    } = await supabase
      .from("bounties")
      .update({
        status: "claimed",
        claimed_by: wallet,
        claimed_at: nowIso,
        claimed_trade_tx: trade.tx_signature,
        claimed_via: source,
      })
      .eq("id", bountyId)
      .eq("status", "active")
      .select("*")
      .maybeSingle();
    if (claimErr) return dbError("atomic bounty claim", claimErr);
    if (!claimedBounty) return { kind: "race_lost", bountyId };

    const rewardPoints = Number(
      (claimedBounty as Bounty).reward_points ?? 0,
    );

    // ---------------------------------------------------------------------
    // 7. Insert claim row with full audit (evaluator reasons + trade fields).
    // ---------------------------------------------------------------------
    const { data: claim, error: insertErr } = await supabase
      .from("claims")
      .insert({
        bounty_id: bountyId,
        wallet,
        trade_tx: trade.tx_signature,
        source,
        evaluator_reasons: evalResult.reasons,
        pnl_percent: trade.pnl_percent,
        asset: trade.asset,
        direction: trade.direction,
        leverage: trade.leverage,
        duration_minutes: trade.duration_minutes,
        claimed_at: nowIso,
      })
      .select("id")
      .single();
    if (insertErr) return dbError("claim insert", insertErr);
    if (!claim?.id) {
      return dbError("claim insert", { message: "no id returned" });
    }

    // ---------------------------------------------------------------------
    // 8. Stats upsert — best-effort. The claim row is the source of truth
    // for points/streaks; user_stats is reconstructable. Failure here logs
    // and falls through to success.
    // ---------------------------------------------------------------------
    try {
      await upsertUserStats(supabase, wallet, rewardPoints, nowIso);
    } catch (err) {
      console.error(
        `[claim-trade] stats upsert failed for wallet=${wallet}: ${(err as Error).message}`,
      );
    }

    return {
      kind: "success",
      claimId: String(claim.id),
      bountyId,
      points: rewardPoints,
    };
  } catch (err) {
    // Any unexpected throw becomes database_error so callers don't have
    // to wrap us in their own try/catch. Genuine programmer bugs (missing
    // arg) thrown at the top of this function bypass this catch since
    // they fire before the try block.
    return {
      kind: "database_error",
      message: err instanceof Error ? err.message : String(err),
    };
  }
}

function dbError(stage: string, err: unknown): ClaimResult {
  const message =
    err && typeof err === "object" && "message" in err
      ? String((err as { message: unknown }).message)
      : String(err);
  return { kind: "database_error", message: `${stage}: ${message}` };
}

async function upsertUserStats(
  supabase: SupabaseClient,
  wallet: string,
  rewardPoints: number,
  nowIso: string,
): Promise<void> {
  const { data: existing, error: fetchErr } = await supabase
    .from("user_stats")
    .select("*")
    .eq("wallet", wallet)
    .maybeSingle();
  if (fetchErr) throw new Error(fetchErr.message);

  const next = existing
    ? {
        wallet,
        total_claims: Number(existing.total_claims ?? 0) + 1,
        total_points: Number(existing.total_points ?? 0) + rewardPoints,
        current_streak: Number(existing.current_streak ?? 0) || 1,
        best_streak: Number(existing.best_streak ?? 0) || 1,
        last_claim_at: nowIso,
      }
    : {
        wallet,
        total_claims: 1,
        total_points: rewardPoints,
        current_streak: 1,
        best_streak: 1,
        last_claim_at: nowIso,
      };

  const { error: upsertErr } = await supabase
    .from("user_stats")
    .upsert(next, { onConflict: "wallet" });
  if (upsertErr) throw new Error(upsertErr.message);
}

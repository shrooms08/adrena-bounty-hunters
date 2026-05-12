// Close-watcher: subscribes to Adrena WS close_position / liquidate events,
// persists each to recent_closes for audit, then runs claim-trade in 'auto'
// mode. One singleton per server process. Does NOT auto-start — server
// boot calls start() once env is validated.
//
// Pipeline per event:
//   1. Persist to recent_closes (audit, idempotent via UNIQUE on tx_sig).
//   2. Compose AdrenaTradeEvent (calls datapi for entry_collateral).
//   3. Find candidate bounties (status=active, asset matches, not expired).
//   4. Try each bounty (highest reward_points first), stop on first success.
//   5. Update recent_closes with claim_result_kind + claim_id.
//
// Step 1 errors are LOUD (throw). Steps 2-5 errors log and the watcher
// keeps running — one bad event must not kill the singleton.
//
// Reconnect gaps are unrecoverable per ROUTES.md — gap_warning is logged
// but no backfill is attempted.

import type { SupabaseClient } from "@supabase/supabase-js";

import type { AdrenaTradeEvent, BountyRow } from "@/types";
import {
  claimTrade,
  type ClaimResult,
  type Evaluator,
} from "@/lib/claim-trade";
import {
  base64SigToBase58,
  composeTradeFromWsEvent,
  type FetchPositionByPda,
} from "@/lib/trade-from-ws-event";
import type {
  AdrenaWsClient,
  WsClosePositionEvent,
  WsLiquidateEvent,
} from "@/lib/adrena-ws";

export interface CloseWatcherDeps {
  ws: AdrenaWsClient;
  supabase: SupabaseClient;
  evaluator: Evaluator;
  fetchPositionByPda: FetchPositionByPda;
  /** Inject for tests; defaults to `() => new Date()`. */
  now?: () => Date;
}

interface AttachedListeners {
  ws: AdrenaWsClient;
  closeHandler: (e: WsClosePositionEvent) => void;
  liquidateHandler: (e: WsLiquidateEvent) => void;
  gapHandler: (info: {
    downtimeMs: number;
    consecutiveFailures: number;
  }) => void;
}

let attached: AttachedListeners | null = null;

export function start(deps: CloseWatcherDeps): void {
  if (attached) return; // idempotent

  const closeHandler = (event: WsClosePositionEvent) => {
    void handleEvent("close", event, deps);
  };
  const liquidateHandler = (event: WsLiquidateEvent) => {
    void handleEvent("liquidate", event, deps);
  };
  const gapHandler = (info: {
    downtimeMs: number;
    consecutiveFailures: number;
  }) => {
    console.warn(
      `[close-watcher] gap_warning downtime=${info.downtimeMs}ms failures=${info.consecutiveFailures} — events during the gap are lost (no replay).`,
    );
  };

  deps.ws.on("close_position", closeHandler);
  deps.ws.on("liquidate", liquidateHandler);
  deps.ws.on("gap_warning", gapHandler);

  attached = {
    ws: deps.ws,
    closeHandler,
    liquidateHandler,
    gapHandler,
  };

  console.log("[close-watcher] started");
}

export function stop(): void {
  if (!attached) return;
  attached.ws.off("close_position", attached.closeHandler);
  attached.ws.off("liquidate", attached.liquidateHandler);
  attached.ws.off("gap_warning", attached.gapHandler);
  attached = null;
  console.log("[close-watcher] stopped");
}

/**
 * Exported for tests. Returns once the per-event pipeline has run to
 * completion (success or skip).
 */
export async function handleEvent(
  kind: "close" | "liquidate",
  event: WsClosePositionEvent | WsLiquidateEvent,
  deps: CloseWatcherDeps,
): Promise<void> {
  const txSignature = base64SigToBase58(event.raw.signature);
  const wallet = event.decoded.owner;
  const positionPda = event.decoded.position;
  const positionIdOnchain = event.decoded.position_id;

  // -------------------------------------------------------------------------
  // Step 1: persist recent_closes. Loud failure if this errors — we cannot
  // process events without an audit trail. Duplicate insert (unique
  // violation) is silently treated as "already saw this event".
  // -------------------------------------------------------------------------
  let auditRowId: string;
  const insertResult = await deps.supabase
    .from("recent_closes")
    .insert({
      tx_signature: txSignature,
      position_pda: positionPda,
      position_id_onchain: positionIdOnchain,
      wallet,
      event_kind: kind,
      raw_payload: event,
    })
    .select("id")
    .single();

  if (insertResult.error) {
    if (isDuplicateKey(insertResult.error)) {
      console.log(
        `[close-watcher] duplicate event tx=${txSignature.slice(0, 16)}…, ignoring`,
      );
      return;
    }
    console.error(
      `[close-watcher] CRITICAL: failed to persist recent_closes for tx=${txSignature.slice(0, 16)}…: ${errorMessage(insertResult.error)}`,
    );
    throw new Error(
      `recent_closes insert failed: ${errorMessage(insertResult.error)}`,
    );
  }
  if (!insertResult.data || typeof (insertResult.data as { id?: unknown }).id !== "string") {
    throw new Error("recent_closes insert returned no id");
  }
  auditRowId = (insertResult.data as { id: string }).id;

  // -------------------------------------------------------------------------
  // Steps 2-5 are best-effort. Anything that throws here is logged but
  // does NOT kill the watcher — the audit row exists for replay.
  // -------------------------------------------------------------------------
  try {
    // Step 2: compose
    const composed = await composeTradeFromWsEvent({
      kind,
      event,
      fetchPosition: deps.fetchPositionByPda,
    });
    if (composed.kind === "skip") {
      console.log(
        `[close-watcher] skip tx=${txSignature.slice(0, 16)}…: ${composed.reason}`,
      );
      await markProcessed(deps.supabase, auditRowId, "skip", null);
      return;
    }

    // Step 3: candidate bounties
    const trade = composed.event;
    const bounties = await findMatchingBounties(deps, trade);

    if (bounties.length === 0) {
      console.log(
        `[close-watcher] no matching bounties tx=${txSignature.slice(0, 16)}… asset=${trade.asset}`,
      );
      await markProcessed(deps.supabase, auditRowId, "no_match", null);
      return;
    }

    // Step 4: try each bounty (highest reward first); stop on success.
    const { finalKind, claimId } = await tryClaimAcrossBounties(
      bounties,
      wallet,
      trade,
      deps,
    );

    // Step 5: update audit row with terminal result.
    await markProcessed(deps.supabase, auditRowId, finalKind, claimId);
  } catch (err) {
    // Audit row exists; ops can replay later.
    console.error(
      `[close-watcher] error processing tx=${txSignature.slice(0, 16)}… (audit row ${auditRowId}, ok to retry): ${(err as Error).message}`,
    );
  }
}

async function findMatchingBounties(
  deps: CloseWatcherDeps,
  trade: AdrenaTradeEvent,
): Promise<BountyRow[]> {
  const now = (deps.now ?? (() => new Date()))();
  const nowIso = now.toISOString();
  const { data, error } = await deps.supabase
    .from("bounties")
    .select("*")
    .eq("status", "active")
    .eq("asset", trade.asset)
    .gt("expires_at", nowIso)
    .order("reward_points", { ascending: false });
  if (error) {
    throw new Error(`bounties lookup failed: ${errorMessage(error)}`);
  }
  return (data ?? []) as BountyRow[];
}

async function tryClaimAcrossBounties(
  bounties: BountyRow[],
  wallet: string,
  trade: AdrenaTradeEvent,
  deps: CloseWatcherDeps,
): Promise<{ finalKind: string; claimId: string | null }> {
  let lastKind = "no_match";
  for (const bounty of bounties) {
    const result: ClaimResult = await claimTrade({
      bountyId: bounty.id,
      wallet,
      source: "auto",
      trade,
      supabase: deps.supabase,
      evaluator: deps.evaluator,
    });
    lastKind = result.kind;

    if (result.kind === "success") {
      return { finalKind: "success", claimId: result.claimId };
    }
    // Terminal failures — no other bounty will succeed either.
    if (
      result.kind === "duplicate_signature" ||
      result.kind === "rate_limited" ||
      result.kind === "database_error"
    ) {
      break;
    }
    // bounty_not_found / bounty_inactive / bounty_expired / race_lost /
    // evaluator_rejected → try the next candidate.
  }
  return { finalKind: lastKind, claimId: null };
}

async function markProcessed(
  supabase: SupabaseClient,
  auditRowId: string,
  kind: string,
  claimId: string | null,
): Promise<void> {
  const { error } = await supabase
    .from("recent_closes")
    .update({
      processed_at: new Date().toISOString(),
      claim_result_kind: kind,
      claim_id: claimId,
    })
    .eq("id", auditRowId);
  if (error) {
    console.error(
      `[close-watcher] failed to mark recent_closes(${auditRowId}) processed=${kind}: ${errorMessage(error)}`,
    );
  }
}

function isDuplicateKey(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { code?: unknown; message?: unknown };
  if (e.code === "23505") return true;
  if (
    typeof e.message === "string" &&
    /duplicate key|unique constraint/i.test(e.message)
  ) {
    return true;
  }
  return false;
}

function errorMessage(err: unknown): string {
  if (err && typeof err === "object" && "message" in err) {
    return String((err as { message: unknown }).message);
  }
  return String(err);
}

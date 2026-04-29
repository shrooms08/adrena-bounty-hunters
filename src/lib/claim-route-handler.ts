// Pure handler for POST /api/bounties/claim. Extracted from route.ts so we
// can unit-test it with injected dependencies (no real Supabase, no real
// datapi). The route file constructs the real dependencies and delegates.

import type { SupabaseClient } from "@supabase/supabase-js";

import type { ApiPosition, ApiTransactionPosition } from "@/lib/adrena-datapi";
import {
  apiPositionToTradeEvent,
  type TradeFromApiResult,
} from "@/lib/trade-from-api";
import {
  claimTrade,
  type ClaimResult,
  type Evaluator,
} from "@/lib/claim-trade";

const BASE58_RE = /^[1-9A-HJ-NP-Za-km-z]+$/;
const WALLET_LEN_MIN = 32;
const WALLET_LEN_MAX = 44;
const SIGNATURE_LEN_MIN = 64;
const SIGNATURE_LEN_MAX = 88;
const BOUNTY_ID_LEN_MAX = 64;

export interface ClaimRouteDeps {
  supabase: SupabaseClient;
  fetchPositionBySignature: (signature: string) => Promise<ApiTransactionPosition>;
  fetchPositionByDbId: (
    wallet: string,
    positionId: number,
  ) => Promise<ApiPosition | null>;
  evaluator: Evaluator;
}

interface ParsedBody {
  bounty_id: string;
  wallet: string;
  signature: string;
}

interface HttpResponse {
  status: number;
  body: Record<string, unknown>;
}

export async function handleClaim(
  request: Request,
  deps: ClaimRouteDeps,
): Promise<HttpResponse> {
  // -------------------------------------------------------------------------
  // 1. Parse + validate body
  // -------------------------------------------------------------------------
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return {
      status: 400,
      body: { error: "Invalid JSON body" },
    };
  }

  const validation = validateBody(raw);
  if ("errors" in validation) {
    return {
      status: 400,
      body: {
        error: "Invalid request",
        fields: validation.errors,
      },
    };
  }
  const { bounty_id, wallet, signature } = validation.body;

  // -------------------------------------------------------------------------
  // 2. Resolve signature → position via /transaction-position.
  // /transaction-position is currently returning 400 for every signature
  // we test against (Phase 1 sigs and fresh last_ix values both rejected).
  // We surface this as a clear 422 so users know it's not their tx — it's
  // the upstream endpoint pending a fix from the Adrena team. Update once
  // br0wnD3v ships the fix.
  // -------------------------------------------------------------------------
  let txPos: ApiTransactionPosition;
  try {
    txPos = await deps.fetchPositionBySignature(signature);
  } catch {
    return {
      status: 422,
      body: {
        error:
          "Could not verify trade. /transaction-position lookup failed — endpoint pending fix from Adrena team",
        signature,
      },
    };
  }

  // -------------------------------------------------------------------------
  // 3. Fetch the full position row (for entry_collateral_amount, pnl, etc).
  // The wallet on the tx must match the claim wallet — covered downstream
  // by claim-trade.ts wallet-binding, but we also short-circuit here to
  // avoid an extra RPC if the caller spoofed someone else's signature.
  // -------------------------------------------------------------------------
  if (txPos.user_wallet !== wallet) {
    return {
      status: 422,
      body: {
        error:
          "Trade does not belong to claiming wallet (tx signer != claim wallet)",
      },
    };
  }

  let position: ApiPosition | null;
  try {
    position = await deps.fetchPositionByDbId(wallet, txPos.position_id);
  } catch {
    return {
      status: 503,
      body: { error: "Position lookup failed; please retry" },
    };
  }
  if (!position) {
    return {
      status: 422,
      body: {
        error:
          "Position not found in datapi (indexing lag?). Try again in ~10s.",
      },
    };
  }

  // -------------------------------------------------------------------------
  // 4. Map → AdrenaTradeEvent. Liquidations are explicitly rejected at the
  // route level so we don't encourage gaming via self-liquidation.
  // Auto-watcher path tolerates them (pipeline-level audit) but the manual
  // route does not.
  // -------------------------------------------------------------------------
  const composed: TradeFromApiResult = apiPositionToTradeEvent(position, {
    wallet,
    signature,
  });

  if (composed.kind === "skip") {
    return {
      status: 422,
      body: {
        error: "Trade not eligible for claim",
        reason: composed.reason,
      },
    };
  }
  if (composed.kind === "liquidate") {
    return {
      status: 422,
      body: { error: "Liquidations cannot claim bounties" },
    };
  }

  // -------------------------------------------------------------------------
  // 5. Run the shared pipeline.
  // -------------------------------------------------------------------------
  const result = await claimTrade({
    bountyId: bounty_id,
    wallet,
    source: "manual",
    trade: composed.event,
    supabase: deps.supabase,
    evaluator: deps.evaluator,
  });

  // -------------------------------------------------------------------------
  // 6. Map ClaimResult → HTTP.
  // -------------------------------------------------------------------------
  return claimResultToHttp(result);
}

function claimResultToHttp(result: ClaimResult): HttpResponse {
  switch (result.kind) {
    case "success":
      return {
        status: 200,
        body: {
          success: true,
          claim_id: result.claimId,
          points: result.points,
        },
      };
    case "bounty_not_found":
      return { status: 404, body: { error: "Bounty not found" } };
    case "bounty_inactive":
      return {
        status: 409,
        body: {
          error: "Bounty no longer active",
          status: result.status,
        },
      };
    case "bounty_expired":
      return { status: 410, body: { error: "Bounty expired" } };
    case "rate_limited":
      return {
        status: 429,
        body: {
          error: "Rate limit exceeded",
          retry_after_seconds: 3600,
        },
      };
    case "evaluator_rejected":
      return {
        status: 422,
        body: {
          error: "Trade does not satisfy bounty conditions",
          reasons: result.reasons,
        },
      };
    case "race_lost":
      return {
        status: 409,
        body: { error: "Bounty was claimed by another trader" },
      };
    case "duplicate_signature":
      return {
        status: 409,
        body: {
          error: "This trade has already claimed a bounty",
          existing_claim_id: result.existingClaimId,
        },
      };
    case "database_error":
      // Never leak the underlying message — could include identifiers,
      // SQL fragments, or supabase internals.
      console.error(
        `[claim-route] database_error: ${result.message}`,
      );
      return { status: 500, body: { error: "Internal error" } };
  }
}

function validateBody(
  raw: unknown,
): { body: ParsedBody } | { errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  if (typeof raw !== "object" || raw === null) {
    return { errors: { body: "must be a JSON object" } };
  }
  const r = raw as Record<string, unknown>;

  const bounty_id = typeof r.bounty_id === "string" ? r.bounty_id.trim() : "";
  if (!bounty_id) {
    errors.bounty_id = "required";
  } else if (bounty_id.length > BOUNTY_ID_LEN_MAX) {
    errors.bounty_id = `too long (max ${BOUNTY_ID_LEN_MAX} chars)`;
  }

  const wallet = typeof r.wallet === "string" ? r.wallet.trim() : "";
  if (!wallet) {
    errors.wallet = "required";
  } else if (
    wallet.length < WALLET_LEN_MIN ||
    wallet.length > WALLET_LEN_MAX ||
    !BASE58_RE.test(wallet)
  ) {
    errors.wallet = "invalid base58 wallet (expected 32-44 chars)";
  }

  const signature = typeof r.signature === "string" ? r.signature.trim() : "";
  if (!signature) {
    errors.signature = "required";
  } else if (
    signature.length < SIGNATURE_LEN_MIN ||
    signature.length > SIGNATURE_LEN_MAX ||
    !BASE58_RE.test(signature)
  ) {
    errors.signature = "invalid base58 signature (expected 64-88 chars)";
  }

  if (Object.keys(errors).length > 0) return { errors };
  return { body: { bounty_id, wallet, signature } };
}

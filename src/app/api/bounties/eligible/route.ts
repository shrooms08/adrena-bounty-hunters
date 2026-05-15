import { NextResponse } from "next/server";
import { evaluateTrade } from "@/lib/bounty-evaluator";
import { fetchPositions } from "@/lib/adrena-datapi";
import { apiPositionToTradeEvent } from "@/lib/trade-from-api";
import { getServiceSupabase } from "@/lib/supabase";
import type { AdrenaTradeEvent, BountyRow } from "@/types";

const TRADES_LIMIT = 50;

export interface ClaimDetails {
  signature: string;
  pnlPercent: number;
  leverage: number;
  durationMinutes: number;
}

export interface EligibilityResponse {
  eligibleBountyIds: string[];
  claimMap: Record<string, ClaimDetails>;
}

function toClaimDetails(trade: AdrenaTradeEvent): ClaimDetails {
  return {
    signature: trade.tx_signature,
    pnlPercent: trade.pnl_percent,
    leverage: trade.leverage,
    durationMinutes: trade.duration_minutes,
  };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const wallet = url.searchParams.get("wallet");

  if (!wallet) {
    return NextResponse.json({ error: "wallet required" }, { status: 400 });
  }

  try {
    const supabase = getServiceSupabase();
    const { data: bountyRows, error: bountyError } = await supabase
      .from("bounties")
      .select("*")
      .eq("status", "active");

    if (bountyError) {
      console.error("[/api/bounties/eligible] supabase error:", bountyError);
      return NextResponse.json({ error: "db error" }, { status: 500 });
    }

    const emptyResponse: EligibilityResponse = {
      eligibleBountyIds: [],
      claimMap: {},
    };

    if (!bountyRows || bountyRows.length === 0) {
      return NextResponse.json(emptyResponse);
    }

    const envelope = await fetchPositions(wallet, {
      status: ["close", "liquidate"],
      sort: "DESC",
      sortField: "exit_date",
      limit: TRADES_LIMIT,
    });

    const tradeEvents: AdrenaTradeEvent[] = [];
    for (const position of envelope.positions) {
      const result = apiPositionToTradeEvent(position, {
        wallet,
        signature: position.last_ix ?? "",
      });
      if (result.kind === "close" || result.kind === "liquidate") {
        tradeEvents.push(result.event);
      }
    }

    if (tradeEvents.length === 0) {
      return NextResponse.json(emptyResponse);
    }

    const eligibleBountyIds: string[] = [];
    const claimMap: Record<string, ClaimDetails> = {};
    for (const bounty of bountyRows as BountyRow[]) {
      const match = tradeEvents.find(
        (trade) => evaluateTrade(bounty, trade).matches,
      );
      if (match && match.tx_signature) {
        eligibleBountyIds.push(bounty.id);
        claimMap[bounty.id] = toClaimDetails(match);
      }
    }

    const response: EligibilityResponse = { eligibleBountyIds, claimMap };
    return NextResponse.json(response);
  } catch (error) {
    console.error("[/api/bounties/eligible] uncaught:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "unknown" },
      { status: 500 },
    );
  }
}

import { NextResponse } from "next/server";
import { evaluateTrade } from "@/lib/bounty-evaluator";
import { fetchPositions } from "@/lib/adrena-datapi";
import { apiPositionToTradeEvent } from "@/lib/trade-from-api";
import { getServiceSupabase } from "@/lib/supabase";
import type { AdrenaTradeEvent, BountyRow } from "@/types";

const TRADES_LIMIT = 50;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const wallet = url.searchParams.get("wallet");

  if (!wallet) {
    return NextResponse.json({ error: "wallet required" }, { status: 400 });
  }

  try {
    // 1. Active bounties.
    const supabase = getServiceSupabase();
    const { data: bountyRows, error: bountyError } = await supabase
      .from("bounties")
      .select("*")
      .eq("status", "active");

    if (bountyError) {
      console.error("[/api/bounties/eligible] supabase error:", bountyError);
      return NextResponse.json({ error: "db error" }, { status: 500 });
    }
    if (!bountyRows || bountyRows.length === 0) {
      return NextResponse.json({ eligibleBountyIds: [] });
    }

    // 2. Wallet's recent close/liquidation positions, newest first.
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
      return NextResponse.json({ eligibleBountyIds: [] });
    }

    // 3. For each bounty, find any trade that satisfies it.
    const eligibleBountyIds: string[] = [];
    for (const bounty of bountyRows as BountyRow[]) {
      const matched = tradeEvents.some(
        (trade) => evaluateTrade(bounty, trade).matches,
      );
      if (matched) eligibleBountyIds.push(bounty.id);
    }

    return NextResponse.json({ eligibleBountyIds });
  } catch (error) {
    console.error("[/api/bounties/eligible] uncaught:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "unknown" },
      { status: 500 },
    );
  }
}

import { NextResponse } from "next/server";

import { fetchTransactionPosition } from "@/lib/adrena-competition";
import { fetchPositions } from "@/lib/adrena-datapi";
import { evaluateTrade } from "@/lib/bounty-evaluator";
import { handleClaim } from "@/lib/claim-route-handler";
import { getServiceSupabase } from "@/lib/supabase";

export async function POST(request: Request) {
  const result = await handleClaim(request, {
    supabase: getServiceSupabase(),
    fetchPositionBySignature: fetchTransactionPosition,
    fetchPositionByDbId: async (wallet, positionId) => {
      const env = await fetchPositions(wallet, {
        position_id: positionId,
        limit: 1,
      });
      return env.positions[0] ?? null;
    },
    evaluator: evaluateTrade,
  });

  console.log(`[claim-route] status=${result.status}`);

  return NextResponse.json(result.body, { status: result.status });
}

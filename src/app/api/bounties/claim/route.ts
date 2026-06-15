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
    fetchPositionByPubkey: async (wallet, pubkey) => {
      // datapi has no pubkey query param, so fetch the wallet's recent
      // positions and match on the PDA. The claimed trade just closed, so
      // it's among the most recent; 20 is a safe window.
      const env = await fetchPositions(wallet, { limit: 20 });
      return env.positions.find((p) => p.pubkey === pubkey) ?? null;
    },
    evaluator: evaluateTrade,
  });

  console.log(`[claim-route] status=${result.status}`);

  return NextResponse.json(result.body, { status: result.status });
}

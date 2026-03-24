import { NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";

interface ClaimBody {
  bounty_id?: string;
  wallet?: string;
  trade_tx?: string;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ClaimBody;
    const bountyId = body.bounty_id?.trim();
    const wallet = body.wallet?.trim();
    const tradeTx = body.trade_tx?.trim();

    if (!bountyId || !wallet || !tradeTx) {
      return NextResponse.json(
        { error: "Missing required fields: bounty_id, wallet, trade_tx" },
        { status: 400 },
      );
    }

    const supabase = getServiceSupabase();

    const { data: bounty, error: bountyError } = await supabase
      .from("bounties")
      .select("*")
      .eq("id", bountyId)
      .maybeSingle();

    if (bountyError) {
      throw new Error(bountyError.message);
    }

    if (!bounty) {
      return NextResponse.json({ error: "Bounty not found" }, { status: 404 });
    }

    if (bounty.status !== "active") {
      return NextResponse.json({ error: "Bounty not available" }, { status: 400 });
    }

    const now = new Date();
    const nowIso = now.toISOString();

    if (new Date(bounty.expires_at).getTime() < now.getTime()) {
      const { error: expireError } = await supabase
        .from("bounties")
        .update({ status: "expired" })
        .eq("id", bountyId);

      if (expireError) {
        throw new Error(expireError.message);
      }

      return NextResponse.json({ error: "Bounty expired" }, { status: 400 });
    }

    const oneHourAgoIso = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
    const { count, error: claimCountError } = await supabase
      .from("claims")
      .select("id", { count: "exact", head: true })
      .eq("wallet", wallet)
      .gte("claimed_at", oneHourAgoIso);

    if (claimCountError) {
      throw new Error(claimCountError.message);
    }

    if ((count ?? 0) >= 3) {
      return NextResponse.json({ error: "Rate limited" }, { status: 429 });
    }

    const { data: updatedBounty, error: updateError } = await supabase
      .from("bounties")
      .update({
        status: "claimed",
        claimed_by: wallet,
        claimed_at: nowIso,
        claimed_trade_tx: tradeTx,
      })
      .eq("id", bountyId)
      .eq("status", "active")
      .select("*")
      .maybeSingle();

    if (updateError) {
      throw new Error(updateError.message);
    }

    if (!updatedBounty) {
      return NextResponse.json({ error: "Bounty not available" }, { status: 400 });
    }

    const { data: claim, error: claimInsertError } = await supabase
      .from("claims")
      .insert({
        bounty_id: bountyId,
        wallet,
        trade_tx: tradeTx,
      })
      .select("*")
      .single();

    if (claimInsertError) {
      throw new Error(claimInsertError.message);
    }

    const { data: existingStats, error: statsFetchError } = await supabase
      .from("user_stats")
      .select("*")
      .eq("wallet", wallet)
      .maybeSingle();

    if (statsFetchError) {
      throw new Error(statsFetchError.message);
    }

    const rewardPoints = Number(updatedBounty.reward_points ?? 0);

    const nextStats = existingStats
      ? {
          wallet,
          total_claims: Number(existingStats.total_claims ?? 0) + 1,
          total_points: Number(existingStats.total_points ?? 0) + rewardPoints,
          current_streak: Number(existingStats.current_streak ?? 0),
          best_streak: Number(existingStats.best_streak ?? 0),
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

    const { error: upsertError } = await supabase
      .from("user_stats")
      .upsert(nextStats, { onConflict: "wallet" });

    if (upsertError) {
      throw new Error(upsertError.message);
    }

    return NextResponse.json({
      data: {
        claim,
        bounty: updatedBounty,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to claim bounty";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

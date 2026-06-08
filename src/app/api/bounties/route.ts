import { NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";

export async function GET() {
  try {
    const supabase = getServiceSupabase();

    const { error: expireError } = await supabase
      .from("bounties")
      .update({ status: "expired" })
      .eq("status", "active")
      .lt("expires_at", new Date().toISOString());

    if (expireError) {
      throw new Error(expireError.message);
    }

    // Active bounties: the claimable board, all of them.
    const { data: active, error: activeError } = await supabase
      .from("bounties")
      .select("*")
      .eq("status", "active")
      .order("created_at", { ascending: false });

    if (activeError) {
      throw new Error(activeError.message);
    }

    // Claimed bounties: social proof, cap at the 20 most recent wins.
    // Expired-unclaimed bounties are intentionally excluded entirely.
    const { data: claimed, error: claimedError } = await supabase
      .from("bounties")
      .select("*")
      .eq("status", "claimed")
      .order("claimed_at", { ascending: false })
      .limit(20);

    if (claimedError) {
      throw new Error(claimedError.message);
    }

    return NextResponse.json({ data: [...(active ?? []), ...(claimed ?? [])] });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch bounties";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

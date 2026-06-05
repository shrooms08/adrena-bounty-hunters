import { NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";

// Junk test rows that must never surface in the live feed.
const JUNK_TRADE_TX = ["vvvvv", "guy"];

interface ClaimRow {
  id: string;
  bounty_id: string;
  wallet: string;
  trade_tx: string;
  leverage: number | null;
  claimed_at: string;
  [key: string]: unknown;
}

interface BountyJoin {
  id: string;
  title: string;
  tier: string;
  reward_points: number;
}

export async function GET() {
  try {
    const supabase = getServiceSupabase();

    const { data: claims, error } = await supabase
      .from("claims")
      .select("*")
      .not("trade_tx", "in", `(${JUNK_TRADE_TX.join(",")})`)
      .order("claimed_at", { ascending: false })
      .limit(10);

    if (error) {
      throw new Error(error.message);
    }

    const rows = (claims ?? []) as ClaimRow[];
    if (rows.length === 0) {
      return NextResponse.json({ data: [] });
    }

    // Join to bounties for title/tier/reward. Done as a follow-up query
    // (rather than a PostgREST embed) so the feed never depends on an FK
    // relationship being present; rows whose bounty is gone are dropped.
    const bountyIds = [...new Set(rows.map((c) => c.bounty_id).filter(Boolean))];
    const { data: bounties, error: bountyError } = await supabase
      .from("bounties")
      .select("id, title, tier, reward_points")
      .in("id", bountyIds);

    if (bountyError) {
      throw new Error(bountyError.message);
    }

    const bountyById = new Map<string, BountyJoin>(
      ((bounties ?? []) as BountyJoin[]).map((b) => [b.id, b]),
    );

    const data = rows
      .filter((c) => bountyById.has(c.bounty_id))
      .map((c) => {
        const bounty = bountyById.get(c.bounty_id)!;
        return {
          ...c,
          bounty_title: bounty.title,
          bounty_tier: bounty.tier,
          reward_points: bounty.reward_points,
        };
      });

    return NextResponse.json({ data });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch claims";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

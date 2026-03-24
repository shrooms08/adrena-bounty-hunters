import { NextResponse } from "next/server";
import { generateBounties } from "@/lib/bounty-generator";
import { getServiceSupabase } from "@/lib/supabase";

export async function GET() {
  try {
    const supabase = getServiceSupabase();
    const nowIso = new Date().toISOString();

    const { count: expiredEligibleCount, error: expireCountError } = await supabase
      .from("bounties")
      .select("*", { count: "exact", head: true })
      .eq("status", "active")
      .lt("expires_at", nowIso);

    if (expireCountError) {
      throw new Error(expireCountError.message);
    }

    const { error: expireUpdateError } = await supabase
      .from("bounties")
      .update({ status: "expired" })
      .eq("status", "active")
      .lt("expires_at", nowIso);

    if (expireUpdateError) {
      throw new Error(expireUpdateError.message);
    }

    const expiredCount = expiredEligibleCount ?? 0;

    const { count: activeCountRaw, error: activeCountError } = await supabase
      .from("bounties")
      .select("*", { count: "exact", head: true })
      .eq("status", "active");

    if (activeCountError) {
      throw new Error(activeCountError.message);
    }

    let activeCount = activeCountRaw ?? 0;
    let generatedCount = 0;

    if (activeCount < 5) {
      const batch = generateBounties(8);
      const { data: inserted, error: insertError } = await supabase
        .from("bounties")
        .insert(batch)
        .select("id");

      if (insertError) {
        throw new Error(insertError.message);
      }

      generatedCount = inserted?.length ?? 0;

      const { count: activeAfterInsert, error: activeAfterError } = await supabase
        .from("bounties")
        .select("*", { count: "exact", head: true })
        .eq("status", "active");

      if (activeAfterError) {
        throw new Error(activeAfterError.message);
      }

      activeCount = activeAfterInsert ?? activeCount + generatedCount;
    }

    return NextResponse.json({
      expired_count: expiredCount,
      active_count: activeCount,
      generated_count: generatedCount,
      message: "Bounty refresh complete",
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Cron bounty refresh failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

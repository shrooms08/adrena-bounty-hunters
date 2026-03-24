import { NextResponse } from "next/server";
import { generateBounties } from "@/lib/bounty-generator";
import { getServiceSupabase } from "@/lib/supabase";

interface CreateBountiesBody {
  count?: number;
}

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

    const { data, error } = await supabase
      .from("bounties")
      .select("*")
      .order("status", { ascending: true })
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({ data: data ?? [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch bounties";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as CreateBountiesBody;
    const count = body.count ?? 8;
    const generated = generateBounties(count);
    const supabase = getServiceSupabase();

    const { data, error } = await supabase
      .from("bounties")
      .insert(generated)
      .select("*");

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({ data: data ?? [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create bounties";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

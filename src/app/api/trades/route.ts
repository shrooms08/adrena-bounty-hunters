import { Connection } from "@solana/web3.js";
import { NextResponse } from "next/server";
import { getRecentAdrenaTrades } from "@/lib/adrena";
import { ADRENA_PROGRAM_ID, SOLANA_RPC } from "@/lib/constants";

export async function GET() {
  try {
    const connection = new Connection(SOLANA_RPC, "confirmed");
    const signatures = await getRecentAdrenaTrades(connection, 10);

    return NextResponse.json({
      data: signatures,
      program: ADRENA_PROGRAM_ID,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch trades";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { runBountyEngine } from "@/lib/bounty-engine";

const CRON_SECRET = process.env.CRON_SECRET;
const ADMIN_TRIGGER_SECRET = process.env.ADMIN_TRIGGER_SECRET;

function authorized(request: Request, secret: string | undefined): boolean {
  if (!secret) return false;
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  if (!CRON_SECRET) {
    return NextResponse.json(
      { error: "CRON_SECRET not configured on the server" },
      { status: 500 },
    );
  }
  if (!authorized(request, CRON_SECRET)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const result = await runBountyEngine();
    console.log("[bounty-engine]", JSON.stringify(result));
    return NextResponse.json(result);
  } catch (error) {
    console.error("[bounty-engine] uncaught:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "unknown" },
      { status: 500 },
    );
  }
}

// Manual-trigger fallback for development. Gated behind a separate env var so
// production cron doesn't accidentally use the dev path.
export async function POST(request: Request) {
  if (!ADMIN_TRIGGER_SECRET) {
    return NextResponse.json(
      { error: "ADMIN_TRIGGER_SECRET not configured" },
      { status: 500 },
    );
  }
  if (!authorized(request, ADMIN_TRIGGER_SECRET)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const result = await runBountyEngine();
    console.log("[bounty-engine][manual]", JSON.stringify(result));
    return NextResponse.json(result);
  } catch (error) {
    console.error("[bounty-engine][manual] uncaught:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "unknown" },
      { status: 500 },
    );
  }
}

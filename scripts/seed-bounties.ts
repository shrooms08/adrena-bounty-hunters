// One-off: runs the bounty engine immediately against the configured
// Supabase project. Use after first deploy to populate the board without
// waiting for the next hourly cron tick.
//
//   npx tsx scripts/seed-bounties.ts
//
// Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in env
// (typically via .env.local during dev, or `vercel env pull`).
import "dotenv/config";
import { runBountyEngine } from "@/lib/bounty-engine";

async function main() {
  const result = await runBountyEngine();
  console.log(JSON.stringify(result, null, 2));
  if (result.errors.length > 0) {
    process.exitCode = 1;
  }
}

void main();

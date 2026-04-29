// Server-side init for long-running services (close-watcher, etc).
// Invoked once per server process from instrumentation.ts.
//
// IMPORTANT: this must NOT auto-start on import. Importing this module from
// e.g. an API route handler must be a no-op. Only initServer() actually
// boots services.

import { connect, getAdrenaWsClient } from "@/lib/adrena-ws";
import { evaluateTrade } from "@/lib/bounty-evaluator";
import { start as startCloseWatcher } from "@/lib/close-watcher";
import { fetchPositions } from "@/lib/adrena-datapi";
import { getServiceSupabase } from "@/lib/supabase";

let initialized = false;

export function initServer(): void {
  if (initialized) return;
  initialized = true;

  if (!process.env.ADRENA_COMPETITION_API_KEY) {
    console.warn(
      "[server-init] ADRENA_COMPETITION_API_KEY not set — close-watcher disabled",
    );
    return;
  }

  const ws = getAdrenaWsClient();

  startCloseWatcher({
    ws,
    supabase: getServiceSupabase(),
    evaluator: evaluateTrade,
    fetchPositionByPda: async (wallet, positionPda) => {
      // Match by PDA — datapi can't filter by on-chain position_id, so we
      // page recent closes for this wallet and find the one whose pubkey
      // matches the WS event's position. POSITION.md §41-44 documents why.
      const env = await fetchPositions(wallet, {
        status: ["close", "liquidate"],
        limit: 50,
        sort: "DESC",
        sortField: "exit_date",
      });
      return env.positions.find((p) => p.pubkey === positionPda) ?? null;
    },
  });

  // Open the WS connection AFTER attaching listeners — otherwise the first
  // info message could fire before the close-watcher subscribes.
  connect();

  console.log("[server-init] services started");
}

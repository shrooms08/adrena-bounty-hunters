import { Connection, PublicKey, type Logs } from "@solana/web3.js";
import { ADRENA_PROGRAM_ID } from "../constants/adrena";
import { decodeEventsFromLogs } from "../parsers/event-decoder";
import { fetchTxEvents } from "../parsers/tx-parser";
import {
  closeRecordFromEvent,
  openRecordFromEvent,
  type IndexerSink,
} from "./sink";

export interface SubscribeOptions {
  // If no Adrena event is observed for this many ms, assume the websocket
  // is stale and reconnect. Default 2 min.
  heartbeatTimeoutMs?: number;
  // Base delay for exponential backoff on reconnection. Default 1 s.
  backoffBaseMs?: number;
  // Maximum backoff delay. Default 30 s.
  backoffMaxMs?: number;
  // Set to interrupt the subscriber loop. Returns true to stop.
  shouldStop?: () => boolean;
}

const DEFAULTS: Required<Omit<SubscribeOptions, "shouldStop">> = {
  heartbeatTimeoutMs: 120_000,
  backoffBaseMs: 1_000,
  backoffMaxMs: 30_000,
};

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

async function handleLog(
  connection: Connection,
  info: Logs,
  slot: number,
  sink: IndexerSink,
): Promise<void> {
  if (info.err) return;
  // Cheap pre-filter: skip if no event data line is present.
  if (!info.logs.some((l) => l.includes("Program data:"))) return;

  // Decode directly from the inline logs (authoritative enough; the signature
  // is from the RPC). We still need blockTime, which onLogs doesn't provide.
  const inlineEvents = decodeEventsFromLogs(info.logs);
  if (inlineEvents.length === 0) return;

  // Resolve blockTime via a single getTransaction. We could use getBlockTime,
  // but getTransaction also double-checks the log set and gives us slot.
  const full = await fetchTxEvents(connection, info.signature);
  if (!full?.blockTime) return;

  for (const ev of full.events) {
    if (ev.name === "OpenPositionEvent") {
      await sink.upsertOpen(
        openRecordFromEvent(ev, info.signature, full.blockTime, slot),
      );
    } else if (ev.name === "ClosePositionEvent") {
      await sink.recordClose(
        closeRecordFromEvent(ev, info.signature, full.blockTime, slot),
      );
    }
  }
}

// Resolves only when shouldStop() returns true or the heartbeat fires.
// Rejects on registration or callback errors so the outer loop can retry.
function runOnce(
  connection: Connection,
  sink: IndexerSink,
  opts: Required<Omit<SubscribeOptions, "shouldStop">>,
  shouldStop: () => boolean,
): Promise<"stopped" | "stale"> {
  return new Promise((resolve, reject) => {
    let lastActivity = Date.now();
    let subId: number | null = null;
    let stopInterval: ReturnType<typeof setInterval> | null = null;
    let done = false;

    const finish = async (outcome: "stopped" | "stale" | "error", err?: unknown) => {
      if (done) return;
      done = true;
      if (stopInterval) clearInterval(stopInterval);
      if (subId !== null) {
        try {
          await connection.removeOnLogsListener(subId);
        } catch {
          // Swallow — we're tearing down anyway.
        }
      }
      if (outcome === "error") reject(err);
      else resolve(outcome);
    };

    try {
      const programPk = new PublicKey(ADRENA_PROGRAM_ID);
      subId = connection.onLogs(
        programPk,
        (info, ctx) => {
          lastActivity = Date.now();
          handleLog(connection, info, ctx.slot, sink).catch((err) =>
            finish("error", err),
          );
        },
        "confirmed",
      );
      console.error(
        `[subscribe] listening on ${ADRENA_PROGRAM_ID} (subId=${subId})`,
      );
    } catch (err) {
      finish("error", err);
      return;
    }

    stopInterval = setInterval(() => {
      if (shouldStop()) {
        finish("stopped");
        return;
      }
      if (Date.now() - lastActivity > opts.heartbeatTimeoutMs) {
        console.error(
          `[subscribe] no activity for ${opts.heartbeatTimeoutMs}ms — reconnecting`,
        );
        finish("stale");
      }
    }, 5_000);
  });
}

export async function subscribeAdrenaEvents(
  connection: Connection,
  sink: IndexerSink,
  options: SubscribeOptions = {},
): Promise<void> {
  const opts: Required<Omit<SubscribeOptions, "shouldStop">> = {
    heartbeatTimeoutMs: options.heartbeatTimeoutMs ?? DEFAULTS.heartbeatTimeoutMs,
    backoffBaseMs: options.backoffBaseMs ?? DEFAULTS.backoffBaseMs,
    backoffMaxMs: options.backoffMaxMs ?? DEFAULTS.backoffMaxMs,
  };
  const shouldStop = options.shouldStop ?? (() => false);

  let attempt = 0;
  while (!shouldStop()) {
    try {
      const outcome = await runOnce(connection, sink, opts, shouldStop);
      if (outcome === "stopped") return;
      // Stale → small pause, then reconnect without counting as a failure.
      await sleep(opts.backoffBaseMs);
      attempt = 0;
    } catch (err) {
      const delay = Math.min(
        opts.backoffMaxMs,
        opts.backoffBaseMs * 2 ** attempt,
      );
      console.error(
        `[subscribe] error (attempt ${attempt}): ${err instanceof Error ? err.message : String(err)} — retrying in ${delay}ms`,
      );
      await sleep(delay);
      attempt++;
    }
  }
}

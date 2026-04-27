import { Connection, PublicKey } from "@solana/web3.js";
import { ADRENA_PROGRAM_ID } from "../constants/adrena";
import { fetchTxEvents } from "../parsers/tx-parser";
import {
  closeRecordFromEvent,
  openRecordFromEvent,
  type IndexerSink,
} from "./sink";

export interface BackfillCursor {
  // Stop pagination once we reach a signature we've already indexed.
  untilSignature?: string;
  // Inclusive lower bound. Skip anything with blockTime < fromTimestamp.
  fromTimestamp?: number; // unix seconds
  // Inclusive upper bound. Skip anything with blockTime > toTimestamp.
  toTimestamp?: number; // unix seconds
  // Hard cap on total signatures scanned.
  maxSignatures?: number;
  // Page size for getSignaturesForAddress. Default 1000 (RPC max).
  pageSize?: number;
  // Delay between getTransaction calls to stay under RPC limits. Default 50ms.
  perTxDelayMs?: number;
}

export interface BackfillReport {
  scanned: number;
  opensIndexed: number;
  closesIndexed: number;
  oldestSignature: string | null;
  oldestBlockTime: number | null;
  newestSignature: string | null;
  newestBlockTime: number | null;
}

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

export async function backfillAdrenaEvents(
  connection: Connection,
  sink: IndexerSink,
  cursor: BackfillCursor = {},
): Promise<BackfillReport> {
  const pageSize = cursor.pageSize ?? 1000;
  const maxSignatures = cursor.maxSignatures ?? Infinity;
  const perTxDelayMs = cursor.perTxDelayMs ?? 50;
  const programPk = new PublicKey(ADRENA_PROGRAM_ID);

  const report: BackfillReport = {
    scanned: 0,
    opensIndexed: 0,
    closesIndexed: 0,
    oldestSignature: null,
    oldestBlockTime: null,
    newestSignature: null,
    newestBlockTime: null,
  };

  let before: string | undefined = undefined;

  outer: while (report.scanned < maxSignatures) {
    const page = await connection.getSignaturesForAddress(programPk, {
      limit: Math.min(pageSize, maxSignatures - report.scanned),
      before,
      until: cursor.untilSignature,
    });
    if (page.length === 0) break;

    for (const sig of page) {
      report.scanned++;
      const bt = sig.blockTime ?? null;
      if (
        cursor.fromTimestamp !== undefined &&
        bt !== null &&
        bt < cursor.fromTimestamp
      ) {
        // Signatures are newest-first; once we cross below fromTimestamp we
        // can stop the whole walk.
        break outer;
      }
      if (
        cursor.toTimestamp !== undefined &&
        bt !== null &&
        bt > cursor.toTimestamp
      ) {
        continue; // still in the "newer than window" prefix; keep scanning
      }

      // Defer to tx-parser to decode. Most program txs are not open/close,
      // but we can't tell without fetching — unavoidable cost of signature
      // backfill. Phase 3 can swap this for a Helius/GetBlock log filter.
      const result = await fetchTxEvents(connection, sig.signature);
      if (result) {
        for (const ev of result.events) {
          if (ev.name === "OpenPositionEvent" && result.blockTime !== null) {
            await sink.upsertOpen(
              openRecordFromEvent(
                ev,
                result.signature,
                result.blockTime,
                result.slot,
              ),
            );
            report.opensIndexed++;
          } else if (
            ev.name === "ClosePositionEvent" &&
            result.blockTime !== null
          ) {
            await sink.recordClose(
              closeRecordFromEvent(
                ev,
                result.signature,
                result.blockTime,
                result.slot,
              ),
            );
            report.closesIndexed++;
          }
        }
      }

      if (bt !== null) {
        if (report.newestBlockTime === null || bt > report.newestBlockTime) {
          report.newestBlockTime = bt;
          report.newestSignature = sig.signature;
        }
        if (report.oldestBlockTime === null || bt < report.oldestBlockTime) {
          report.oldestBlockTime = bt;
          report.oldestSignature = sig.signature;
        }
      }

      if (perTxDelayMs > 0) await sleep(perTxDelayMs);
    }

    before = page[page.length - 1].signature;
    if (page.length < pageSize) break;
  }

  return report;
}

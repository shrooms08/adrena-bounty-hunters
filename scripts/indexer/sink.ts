import type {
  DecodedClosePositionEvent,
  DecodedOpenPositionEvent,
} from "../parsers/event-decoder";

export interface OpenRecord {
  owner: string;
  positionId: string;
  custodyMint: string;
  side: number;
  sizeUsd: string;
  price: string;
  collateralAmountUsd: string;
  leverage: number;
  signature: string;
  blockTime: number;
  slot: number;
}

export interface CloseRecord {
  owner: string;
  positionId: string;
  custodyMint: string;
  side: number;
  signature: string;
  blockTime: number;
  slot: number;
  profitUsd: string;
  lossUsd: string;
}

export interface IndexerSink {
  upsertOpen(record: OpenRecord): Promise<void>;
  recordClose(record: CloseRecord): Promise<void>;
  getOpen(owner: string, positionId: string): Promise<OpenRecord | null>;
}

// Phase 1 default — stores opens in memory and logs closes to stdout.
// Phase 2 will swap this for a Supabase-backed sink writing to adrena_opens.
export class MemoryAndLogSink implements IndexerSink {
  private opens = new Map<string, OpenRecord>();

  private key(owner: string, positionId: string): string {
    return `${owner}:${positionId}`;
  }

  async upsertOpen(record: OpenRecord): Promise<void> {
    this.opens.set(this.key(record.owner, record.positionId), record);
    console.log(
      JSON.stringify({ type: "open", ...record, _cached_opens: this.opens.size }),
    );
  }

  async recordClose(record: CloseRecord): Promise<void> {
    const matchedOpen = this.opens.get(this.key(record.owner, record.positionId));
    console.log(
      JSON.stringify({
        type: "close",
        ...record,
        matchedOpen: matchedOpen
          ? { signature: matchedOpen.signature, blockTime: matchedOpen.blockTime }
          : null,
      }),
    );
  }

  async getOpen(owner: string, positionId: string): Promise<OpenRecord | null> {
    return this.opens.get(this.key(owner, positionId)) ?? null;
  }
}

export function openRecordFromEvent(
  event: DecodedOpenPositionEvent,
  signature: string,
  blockTime: number,
  slot: number,
): OpenRecord {
  return {
    owner: event.owner.toBase58(),
    positionId: event.positionId.toString(),
    custodyMint: event.custodyMint.toBase58(),
    side: event.side,
    sizeUsd: event.sizeUsd.toString(),
    price: event.price.toString(),
    collateralAmountUsd: event.collateralAmountUsd.toString(),
    leverage: event.leverage,
    signature,
    blockTime,
    slot,
  };
}

export function closeRecordFromEvent(
  event: DecodedClosePositionEvent,
  signature: string,
  blockTime: number,
  slot: number,
): CloseRecord {
  return {
    owner: event.owner.toBase58(),
    positionId: event.positionId.toString(),
    custodyMint: event.custodyMint.toBase58(),
    side: event.side,
    signature,
    blockTime,
    slot,
    profitUsd: event.profitUsd.toString(),
    lossUsd: event.lossUsd.toString(),
  };
}

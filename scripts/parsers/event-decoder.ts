import { BorshEventCoder, Idl } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import BN from "bn.js";
import { checkEventBytes } from "./schema-check";

// Adrena IDL is tracked at adrena-reference/adrena-abi on branch release/39
// (Anchor 0.30 format: events reference structs declared in idl.types[],
// pubkey/u64/u32 typed, camelCase on decode).
// eslint-disable-next-line @typescript-eslint/no-require-imports
const idl = require("../../../adrena-reference/adrena-abi/idl/adrena.json") as Idl;

const coder = new BorshEventCoder(idl);

// Anchor program logs carry events as "Program data: <base64>" lines.
// Each base64 payload is the 8-byte event discriminator followed by the
// borsh-encoded event fields.
const PROGRAM_DATA_PREFIX = "Program data: ";

export interface DecodedClosePositionEvent {
  name: "ClosePositionEvent";
  owner: PublicKey;
  position: PublicKey;
  custodyMint: PublicKey;
  custodySeed: number[]; // [u8; 32] — PDA seed, not needed for trade composition
  side: number;
  sizeUsd: BN;
  price: BN;
  collateralAmountUsd: BN;
  profitUsd: BN;
  lossUsd: BN;
  borrowFeeUsd: BN;
  exitFeeUsd: BN;
  positionId: BN;
  percentage: BN;
  fundingPaidUsd: BN;
  fundingReceivedUsd: BN;
  poolType: number;
}

export interface DecodedOpenPositionEvent {
  name: "OpenPositionEvent";
  owner: PublicKey;
  position: PublicKey;
  custodyMint: PublicKey;
  custodySeed: number[];
  side: number;
  sizeUsd: BN;
  price: BN;
  collateralAmountUsd: BN;
  leverage: number;
  positionId: BN;
  poolType: number;
}

export type DecodedAdrenaEvent =
  | DecodedClosePositionEvent
  | DecodedOpenPositionEvent;

export function decodeProgramDataLine(
  line: string,
): DecodedAdrenaEvent | null {
  const idx = line.indexOf(PROGRAM_DATA_PREFIX);
  if (idx === -1) return null;

  const payload = line.slice(idx + PROGRAM_DATA_PREFIX.length).trim();
  if (!payload) return null;

  const event = coder.decode(payload);
  if (!event) return null;

  if (
    event.name === "ClosePositionEvent" ||
    event.name === "OpenPositionEvent"
  ) {
    const rawBytes = Buffer.from(payload, "base64").length;
    checkEventBytes(event.name, rawBytes);
    // Anchor 0.30 preserves the IDL's snake_case field names. The rest of
    // the pipeline uses camelCase (AdrenaTradeEvent contract, BN/PublicKey
    // helpers). Rename at the boundary so downstream code doesn't need to
    // know which IDL version produced it.
    const camel = snakeToCamelKeys(event.data as Record<string, unknown>);
    return { name: event.name, ...camel } as DecodedAdrenaEvent;
  }
  return null;
}

function snakeToCamel(s: string): string {
  return s.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
}

function snakeToCamelKeys(
  obj: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) out[snakeToCamel(k)] = v;
  return out;
}

export function decodeEventsFromLogs(logs: string[]): DecodedAdrenaEvent[] {
  const events: DecodedAdrenaEvent[] = [];
  for (const line of logs) {
    const decoded = decodeProgramDataLine(line);
    if (decoded) events.push(decoded);
  }
  return events;
}

export function findCloseEvent(
  events: DecodedAdrenaEvent[],
): DecodedClosePositionEvent | null {
  return (
    (events.find(
      (e): e is DecodedClosePositionEvent => e.name === "ClosePositionEvent",
    ) as DecodedClosePositionEvent | undefined) ?? null
  );
}

export function findOpenEvent(
  events: DecodedAdrenaEvent[],
): DecodedOpenPositionEvent | null {
  return (
    (events.find(
      (e): e is DecodedOpenPositionEvent => e.name === "OpenPositionEvent",
    ) as DecodedOpenPositionEvent | undefined) ?? null
  );
}

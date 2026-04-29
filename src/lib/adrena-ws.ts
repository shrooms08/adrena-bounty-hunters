// Persistent WebSocket client for the Adrena competition relay at
// wss://adrena-competition-service.onrender.com/<API_KEY>.
//
// Documented in docs/ROUTES.md. This file is transport + lifecycle only —
// no business logic. Watcher modules (close-watcher, alpha-watcher) attach
// listeners and own their state.
//
// Conventions:
//   - Singleton per process via getAdrenaWsClient().
//   - Typed event emitter (event names enforced at compile time).
//   - We never auto-connect. The server entry point calls connect() once
//     env vars are validated. Tests call neither.
//   - All wire events use snake_case field names matching ROUTES.md verbatim.
//     u64 USD fields arrive as decimal strings — we pass them through.

import { EventEmitter } from "node:events";
import WebSocket, { type RawData } from "ws";

// ---------------------------------------------------------------------------
// Wire types — match ROUTES.md verbatim.
// ---------------------------------------------------------------------------

export interface WsRawTransaction {
  signature: string;
  slot: string;
  logs: string[];
  err: null;
}

export interface WsRawAccount {
  pubkey: string;
  slot: string;
  lamports: string;
  is_closed: boolean;
  data_length: number;
  is_startup: boolean;
}

export interface WsInfoPayload {
  programId: string;
  message: string;
  messageTypes: Record<string, string>;
  conventions: Record<string, string>;
  subscription: Record<string, unknown>;
}

export interface WsPositionAccountDecoded {
  bump: number;
  side: number;
  take_profit_is_set: number;
  stop_loss_is_set: number;
  owner: string;
  pool: string;
  custody: string;
  collateral_custody: string;
  open_time: string;
  update_time: string;
  price: string;
  size_usd: string;
  borrow_size_usd: string;
  collateral_usd: string;
  unrealized_interest_usd: string;
  cumulative_interest_snapshot: { high: string; low: string };
  locked_amount: string;
  collateral_amount: string;
  exit_fee_usd: string;
  liquidation_fee_usd: string;
  id: string;
  take_profit_limit_price: string;
  paid_interest_usd: string;
  stop_loss_limit_price: string;
  stop_loss_close_position_price: string;
  cumulative_long_to_short_snapshot: { high: string; low: string };
  cumulative_short_to_long_snapshot: { high: string; low: string };
  unrealized_funding_paid_usd: string;
  unrealized_funding_received_usd: string;
}

export interface WsClosePositionDecoded {
  owner: string;
  position: string;
  custody_mint: string;
  custody_seed: number[];
  side: number;
  size_usd: string;
  price: string;
  collateral_amount_usd: string;
  profit_usd: string;
  loss_usd: string;
  borrow_fee_usd: string;
  exit_fee_usd: string;
  position_id: string;
  percentage: string;
  funding_paid_usd: string;
  funding_received_usd: string;
  pool_type: number;
}

export interface WsLiquidateDecoded {
  owner: string;
  position: string;
  custody_mint: string;
  custody_seed: number[];
  side: number;
  size_usd: string;
  price: string;
  collateral_amount_usd: string;
  loss_usd: string;
  borrow_fee_usd: string;
  exit_fee_usd: string;
  liquidation_fee_usd: string;
  position_id: string;
  funding_paid_usd: string;
  funding_received_usd: string;
  pool_type: number;
}

export type WsPingData = Record<string, never> | { status: "no_upstream" };

export interface WsPositionAccountEvent {
  filter: string;
  timestamp: number;
  raw: WsRawAccount;
  decoded: WsPositionAccountDecoded;
}

export interface WsClosePositionEvent {
  filter: string;
  timestamp: number;
  raw: WsRawTransaction;
  decoded: WsClosePositionDecoded;
}

export interface WsLiquidateEvent {
  filter: string;
  timestamp: number;
  raw: WsRawTransaction;
  decoded: WsLiquidateDecoded;
}

export interface WsPingEvent {
  filter: string;
  timestamp: number;
  data: WsPingData;
}

// ---------------------------------------------------------------------------
// Connection state machine
// ---------------------------------------------------------------------------

export type ConnectionState =
  | "disconnected"
  | "connecting"
  | "connected"
  | "degraded"
  | "reconnecting"
  | "shutdown";

// ---------------------------------------------------------------------------
// Tunables
// ---------------------------------------------------------------------------

const EXPECTED_PROGRAM_ID = "13gDzEXCdocbj8iAiqrScGo47NiSuYENGsRqi3SEAwet";

const INITIAL_BACKOFF_MS = 1_000;
const MAX_BACKOFF_MS = 30_000;
const IDLE_TIMEOUT_MS = 90_000;
const GAP_WARNING_AFTER_FAILURES = 5;

function getWsUrl(): string {
  const base =
    process.env.ADRENA_COMPETITION_WS_URL ??
    "wss://adrena-competition-service.onrender.com";
  const key = process.env.ADRENA_COMPETITION_API_KEY;
  if (!key) {
    throw new Error(
      "ADRENA_COMPETITION_API_KEY is not set. The relay requires the key in the URL path; without it the handshake is refused.",
    );
  }
  return `${base.replace(/\/+$/, "")}/${key}`;
}

// ---------------------------------------------------------------------------
// Typed EventEmitter
// ---------------------------------------------------------------------------

interface AdrenaWsEvents {
  // Wire events (forwarded from the server)
  info: (payload: WsInfoPayload) => void;
  position_account: (payload: WsPositionAccountEvent) => void;
  close_position: (payload: WsClosePositionEvent) => void;
  liquidate: (payload: WsLiquidateEvent) => void;
  ping: (payload: WsPingEvent) => void;

  // Synthesized lifecycle events
  connected: () => void;
  disconnected: (info: { code: number; reason: string }) => void;
  degraded: () => void;
  reconnecting: (info: { attempt: number; delayMs: number }) => void;
  gap_warning: (info: {
    downtimeMs: number;
    consecutiveFailures: number;
  }) => void;
}

type EventName = keyof AdrenaWsEvents;

export interface AdrenaWsClient {
  on<E extends EventName>(event: E, listener: AdrenaWsEvents[E]): this;
  off<E extends EventName>(event: E, listener: AdrenaWsEvents[E]): this;
  once<E extends EventName>(event: E, listener: AdrenaWsEvents[E]): this;
  emit<E extends EventName>(
    event: E,
    ...args: Parameters<AdrenaWsEvents[E]>
  ): boolean;
}

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

export class AdrenaWsClient extends EventEmitter {
  private state: ConnectionState = "disconnected";
  private ws: WebSocket | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private idleTimer: NodeJS.Timeout | null = null;
  private currentBackoffMs = INITIAL_BACKOFF_MS;
  private consecutiveFailures = 0;
  private disconnectedAt: number | null = null;
  private gapWarningEmitted = false;
  private lastInfo: WsInfoPayload | null = null;
  private wantConnected = false;
  private lastMessageAt: number | null = null;

  getState(): ConnectionState {
    return this.state;
  }

  getLastInfo(): WsInfoPayload | null {
    return this.lastInfo;
  }

  lastMessageTimestamp(): number | null {
    return this.lastMessageAt;
  }

  connect(): void {
    if (this.wantConnected) return; // idempotent
    this.wantConnected = true;
    this.consecutiveFailures = 0;
    this.currentBackoffMs = INITIAL_BACKOFF_MS;
    this.gapWarningEmitted = false;
    this.openSocket();
  }

  disconnect(): void {
    this.wantConnected = false;
    this.setState("shutdown");
    this.clearReconnectTimer();
    this.clearIdleTimer();
    if (this.ws) {
      this.teardownSocket(this.ws);
      try {
        this.ws.close(1000, "client disconnect");
      } catch {
        /* ignore */
      }
      this.ws = null;
    }
  }

  // -------------------------------------------------------------------------
  // Internals
  // -------------------------------------------------------------------------

  private setState(next: ConnectionState): void {
    this.state = next;
  }

  private openSocket(): void {
    if (!this.wantConnected) return;
    this.clearReconnectTimer();
    this.setState(
      this.state === "reconnecting" ? "reconnecting" : "connecting",
    );
    if (this.state === "reconnecting") this.setState("connecting");

    let url: string;
    try {
      url = getWsUrl();
    } catch (err) {
      // Fatal — env not configured. Don't reconnect.
      console.error(`[adrena-ws] ${(err as Error).message}`);
      this.wantConnected = false;
      this.setState("shutdown");
      return;
    }

    let ws: WebSocket;
    try {
      ws = new WebSocket(url, { handshakeTimeout: 30_000 });
    } catch (err) {
      console.warn(
        `[adrena-ws] WebSocket construct failed: ${(err as Error).message}`,
      );
      this.scheduleReconnect();
      return;
    }
    this.ws = ws;

    ws.on("open", () => {
      // TCP+WS handshake done. Now waiting for the `info` message before
      // declaring 'connected'.
      console.log(`[adrena-ws] socket open, awaiting info`);
      this.armIdleTimer();
    });

    ws.on("message", (data: RawData) => this.handleMessage(data));

    ws.on("ping", () => {
      // The `ws` library auto-replies with pong; we attach for refreshing
      // the idle timer (server protocol pings count as activity).
      this.armIdleTimer();
    });

    ws.on("close", (code: number, reasonBuf: Buffer) => {
      const reason = reasonBuf?.toString() ?? "";
      console.log(`[adrena-ws] socket closed code=${code} reason="${reason}"`);
      this.clearIdleTimer();
      this.emit("disconnected", { code, reason });
      this.ws = null;
      this.disconnectedAt = Date.now();
      if (this.wantConnected) {
        this.scheduleReconnect();
      }
    });

    ws.on("error", (err: Error) => {
      // Surface but don't act — 'close' fires right after, where we schedule
      // the reconnect.
      console.warn(`[adrena-ws] socket error: ${err.message}`);
    });
  }

  private teardownSocket(ws: WebSocket): void {
    // Memory hygiene — strip every listener before letting the socket drop.
    ws.removeAllListeners("open");
    ws.removeAllListeners("message");
    ws.removeAllListeners("ping");
    ws.removeAllListeners("pong");
    ws.removeAllListeners("close");
    ws.removeAllListeners("error");
  }

  private handleMessage(data: RawData): void {
    this.lastMessageAt = Date.now();
    this.armIdleTimer();

    let parsed: { type?: string } & Record<string, unknown>;
    try {
      const text = data.toString("utf8");
      parsed = JSON.parse(text);
    } catch (err) {
      console.warn(
        `[adrena-ws] could not parse frame as JSON: ${(err as Error).message}`,
      );
      return;
    }

    const type = parsed.type;
    switch (type) {
      case "info":
        this.handleInfo(parsed as unknown as WsInfoPayload);
        break;
      case "position_account":
        this.emit(
          "position_account",
          parsed as unknown as WsPositionAccountEvent,
        );
        break;
      case "close_position":
        this.emit(
          "close_position",
          parsed as unknown as WsClosePositionEvent,
        );
        this.exitDegradedIfNeeded();
        break;
      case "liquidate":
        this.emit("liquidate", parsed as unknown as WsLiquidateEvent);
        this.exitDegradedIfNeeded();
        break;
      case "ping":
        this.handlePing(parsed as unknown as WsPingEvent);
        break;
      default:
        console.warn(`[adrena-ws] unknown message type: ${type}`);
    }
  }

  private handleInfo(payload: WsInfoPayload): void {
    if (payload.programId !== EXPECTED_PROGRAM_ID) {
      console.error(
        `[adrena-ws] FATAL: programId mismatch. expected=${EXPECTED_PROGRAM_ID} got=${payload.programId}`,
      );
      this.wantConnected = false;
      if (this.ws) {
        try {
          this.ws.close(1008, "programId mismatch");
        } catch {
          /* ignore */
        }
      }
      this.setState("shutdown");
      return;
    }

    this.lastInfo = payload;
    this.setState("connected");
    this.consecutiveFailures = 0;
    this.currentBackoffMs = INITIAL_BACKOFF_MS;
    this.gapWarningEmitted = false;
    this.disconnectedAt = null;
    console.log(
      `[adrena-ws] info received, programId=${payload.programId}, state=connected`,
    );
    this.emit("info", payload);
    this.emit("connected");
  }

  private handlePing(payload: WsPingEvent): void {
    this.emit("ping", payload);
    if (
      payload.data &&
      typeof payload.data === "object" &&
      "status" in payload.data &&
      payload.data.status === "no_upstream"
    ) {
      if (this.state !== "degraded") {
        this.setState("degraded");
        console.warn(`[adrena-ws] entering degraded state (no_upstream)`);
        this.emit("degraded");
      }
    } else {
      this.exitDegradedIfNeeded();
    }
  }

  private exitDegradedIfNeeded(): void {
    if (this.state === "degraded") {
      this.setState("connected");
      console.log(`[adrena-ws] leaving degraded state, upstream active`);
      // No dedicated event — caller can treat the next regular event as
      // recovery, and `connected` was already emitted on the original info.
    }
  }

  private scheduleReconnect(): void {
    if (!this.wantConnected) return;
    if (this.reconnectTimer) return;

    this.consecutiveFailures += 1;
    const delay = this.currentBackoffMs;
    // Plan next attempt's delay (capped). Successful info will reset to
    // INITIAL_BACKOFF_MS in handleInfo().
    this.currentBackoffMs = Math.min(this.currentBackoffMs * 2, MAX_BACKOFF_MS);

    this.setState("reconnecting");
    console.log(
      `[adrena-ws] reconnect attempt=${this.consecutiveFailures} delay=${delay}ms`,
    );
    this.emit("reconnecting", {
      attempt: this.consecutiveFailures,
      delayMs: delay,
    });

    if (
      this.consecutiveFailures >= GAP_WARNING_AFTER_FAILURES &&
      !this.gapWarningEmitted
    ) {
      const downtimeMs = this.disconnectedAt
        ? Date.now() - this.disconnectedAt
        : 0;
      this.gapWarningEmitted = true;
      console.warn(
        `[adrena-ws] gap_warning: downtime=${downtimeMs}ms failures=${this.consecutiveFailures}`,
      );
      this.emit("gap_warning", {
        downtimeMs,
        consecutiveFailures: this.consecutiveFailures,
      });
    }

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (this.ws) {
        this.teardownSocket(this.ws);
        this.ws = null;
      }
      this.openSocket();
    }, delay);
  }

  private armIdleTimer(): void {
    this.clearIdleTimer();
    this.idleTimer = setTimeout(() => {
      console.warn(
        `[adrena-ws] idle ${IDLE_TIMEOUT_MS}ms with no message — forcing reconnect`,
      );
      if (this.ws) {
        // Tear down listeners so the close handler doesn't double-schedule.
        const dead = this.ws;
        this.teardownSocket(dead);
        try {
          dead.terminate();
        } catch {
          /* ignore */
        }
        this.ws = null;
      }
      this.disconnectedAt = Date.now();
      this.scheduleReconnect();
    }, IDLE_TIMEOUT_MS);
  }

  private clearIdleTimer(): void {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }
}

// ---------------------------------------------------------------------------
// Singleton accessor
// ---------------------------------------------------------------------------

let instance: AdrenaWsClient | null = null;

export function getAdrenaWsClient(): AdrenaWsClient {
  if (!instance) {
    instance = new AdrenaWsClient();
  }
  return instance;
}

export function connect(): void {
  getAdrenaWsClient().connect();
}

export function disconnect(): void {
  getAdrenaWsClient().disconnect();
}

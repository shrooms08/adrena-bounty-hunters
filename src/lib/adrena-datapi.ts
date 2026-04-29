// Thin client for the public Adrena Data API at https://datapi.adrena.trade.
// Documented in docs/POSITION.md. Field shapes here match the live response
// (which differs slightly from POSITION.md — extra accounting columns, and
// numerics arrive as JS numbers rather than strings as the doc claims).
//
// Conventions enforced here:
//  - Snake_case field names match the API verbatim. Conversion to camelCase
//    happens in mapper modules, never at this boundary.
//  - All numeric fields are wrapped in Decimal regardless of the wire type.
//    Even though the API hands us JS floats, downstream math (PnL %, leverage
//    bands, volume thresholds) routes through Decimal so we never compound
//    floating-point error.
//  - Never log full response bodies — they contain wallet addresses. Status
//    codes and array counts only.

import { Decimal } from "decimal.js";

const DEFAULT_BASE_URL = "https://datapi.adrena.trade";
const DEFAULT_TIMEOUT_MS = 8_000;

const RETRY_DELAYS_MS = [500, 1_000, 2_000] as const;

function getBaseUrl(): string {
  return process.env.ADRENA_DATAPI_BASE_URL ?? DEFAULT_BASE_URL;
}

// ---------------------------------------------------------------------------
// Domain types — snake_case, matching the live API response.
// ---------------------------------------------------------------------------

export type PositionSide = "long" | "short";
export type PositionStatus = "open" | "close" | "liquidate";

export interface ApiPosition {
  position_id: number;
  pool_id: number;
  user_id: number;
  symbol: string;
  token_account_mint: string;
  side: PositionSide;
  status: PositionStatus;
  pubkey: string;

  entry_price: Decimal;
  exit_price: Decimal | null;

  entry_size: Decimal;
  increase_size: Decimal;
  decrease_size: Decimal;
  close_size: Decimal;
  exit_size: Decimal;

  pnl: Decimal | null;
  decrease_pnl: Decimal | null;
  close_pnl: Decimal | null;

  entry_leverage: Decimal;
  lowest_leverage: Decimal;

  entry_date: string;
  exit_date: string | null;

  fees: Decimal | null;
  total_decrease_fees: Decimal | null;
  total_close_fees: Decimal | null;
  borrow_fees: Decimal | null;
  decrease_borrow_fees: Decimal | null;
  close_borrow_fees: Decimal | null;
  exit_fees: Decimal | null;
  decrease_exit_fees: Decimal | null;
  close_exit_fees: Decimal | null;

  funding_paid_usd: Decimal | null;
  funding_received_usd: Decimal | null;

  last_ix: string | null;

  entry_collateral_amount: Decimal;
  entry_collateral_amount_native: Decimal;
  increase_collateral_amount: Decimal;
  increase_collateral_amount_native: Decimal;
  decrease_collateral_amount: Decimal;
  decrease_collateral_amount_native: Decimal;
  close_collateral_amount: Decimal;
  close_collateral_amount_native: Decimal;
  collateral_amount: Decimal;
  collateral_amount_native: Decimal;
  exit_amount_native: Decimal | null;

  closed_by_sl_tp: boolean;

  volume: Decimal;
  duration: number | null;

  pnl_volume_ratio: Decimal | null;
  points_pnl_volume_ratio: Decimal | null;
  points_duration: Decimal | null;
  close_size_multiplier: Decimal | null;
  points_mutations: Decimal | null;
  total_points: Decimal | null;

  created_at: string;
  updated_at: string;
}

export interface ApiPositionsEnvelope {
  positions: ApiPosition[];
  offset: number;
  limit: number;
  total_count: number;
  pool_name: string | null;
}

export interface ApiTransactionPosition {
  position_id: number;
  method: string; // e.g. "openPositionLong" | "closePositionLong" | "liquidateLong" | ...
  transaction_date: string;
  slot: number;
  side: PositionSide;
  user_wallet: string;
}

export interface ApiTraderInfo {
  user_pubkey: string;
  total_pnl: Decimal;
  total_fees: Decimal;
  total_borrow_fees: Decimal;
  total_exit_fees: Decimal;
  total_volume: Decimal;
  total_number_positions: number;
  total_number_positions_open: number;
  total_number_positions_closed: number;
  total_number_positions_liquidated: number;
  win_rate_percentage: Decimal;
  largest_winning_trade: Decimal;
  largest_losing_trade: Decimal;
  best_trading_performance: Decimal;
  worst_trading_performance: Decimal;
  avg_win_pnl: Decimal;
  avg_loss_pnl: Decimal;
  avg_volume: Decimal;
  avg_pnl: Decimal;
  avg_fees: Decimal;
  avg_borrow_fees: Decimal;
  avg_trading_performance: Decimal;
  avg_entry_leverage: Decimal;
  avg_entry_size: Decimal;
  avg_exit_size: Decimal;
  avg_entry_collateral_amount: Decimal;
  avg_holding_time: Decimal;
}

export interface ApiTraderProfile {
  user_wallet: string;
  nickname: string | null;
  total_volume: Decimal;
  // Endpoint may include additional aggregates; pass-through preserved as
  // unknown so consumers can opt in once we use them.
  [extra: string]: unknown;
}

export interface ApiTraderVolumeRow {
  user_wallet: string;
  volume_usd: Decimal;
  trades_count: number;
}

// ---------------------------------------------------------------------------
// Numeric / record helpers
// ---------------------------------------------------------------------------

type RawNumeric = number | string | null | undefined;

function decimalOrNull(v: RawNumeric): Decimal | null {
  if (v === null || v === undefined) return null;
  return new Decimal(v);
}

function decimalOr(v: RawNumeric, fallback: Decimal): Decimal {
  return decimalOrNull(v) ?? fallback;
}

const ZERO = new Decimal(0);

function decimalOrZero(v: RawNumeric): Decimal {
  return decimalOr(v, ZERO);
}

/**
 * Parse a raw /v4/position row into the typed ApiPosition shape (Decimal
 * for numerics). Exposed so test fixtures in scripts/__tests__ can drive
 * downstream pure functions (trade-from-api, etc.) without re-mocking the
 * whole adrena-datapi module.
 */
export function parseApiPosition(raw: Record<string, unknown>): ApiPosition {
  const r = raw as Record<string, RawNumeric | string | boolean | null>;
  return {
    position_id: Number(r.position_id),
    pool_id: Number(r.pool_id),
    user_id: Number(r.user_id),
    symbol: String(r.symbol),
    token_account_mint: String(r.token_account_mint),
    side: r.side as PositionSide,
    status: r.status as PositionStatus,
    pubkey: String(r.pubkey),

    entry_price: decimalOrZero(r.entry_price as RawNumeric),
    exit_price: decimalOrNull(r.exit_price as RawNumeric),

    entry_size: decimalOrZero(r.entry_size as RawNumeric),
    increase_size: decimalOrZero(r.increase_size as RawNumeric),
    decrease_size: decimalOrZero(r.decrease_size as RawNumeric),
    close_size: decimalOrZero(r.close_size as RawNumeric),
    exit_size: decimalOrZero(r.exit_size as RawNumeric),

    pnl: decimalOrNull(r.pnl as RawNumeric),
    decrease_pnl: decimalOrNull(r.decrease_pnl as RawNumeric),
    close_pnl: decimalOrNull(r.close_pnl as RawNumeric),

    entry_leverage: decimalOrZero(r.entry_leverage as RawNumeric),
    lowest_leverage: decimalOrZero(r.lowest_leverage as RawNumeric),

    entry_date: String(r.entry_date),
    exit_date: r.exit_date == null ? null : String(r.exit_date),

    fees: decimalOrNull(r.fees as RawNumeric),
    total_decrease_fees: decimalOrNull(r.total_decrease_fees as RawNumeric),
    total_close_fees: decimalOrNull(r.total_close_fees as RawNumeric),
    borrow_fees: decimalOrNull(r.borrow_fees as RawNumeric),
    decrease_borrow_fees: decimalOrNull(r.decrease_borrow_fees as RawNumeric),
    close_borrow_fees: decimalOrNull(r.close_borrow_fees as RawNumeric),
    exit_fees: decimalOrNull(r.exit_fees as RawNumeric),
    decrease_exit_fees: decimalOrNull(r.decrease_exit_fees as RawNumeric),
    close_exit_fees: decimalOrNull(r.close_exit_fees as RawNumeric),

    funding_paid_usd: decimalOrNull(r.funding_paid_usd as RawNumeric),
    funding_received_usd: decimalOrNull(r.funding_received_usd as RawNumeric),

    last_ix: r.last_ix == null ? null : String(r.last_ix),

    entry_collateral_amount: decimalOrZero(r.entry_collateral_amount as RawNumeric),
    entry_collateral_amount_native: decimalOrZero(
      r.entry_collateral_amount_native as RawNumeric,
    ),
    increase_collateral_amount: decimalOrZero(r.increase_collateral_amount as RawNumeric),
    increase_collateral_amount_native: decimalOrZero(
      r.increase_collateral_amount_native as RawNumeric,
    ),
    decrease_collateral_amount: decimalOrZero(r.decrease_collateral_amount as RawNumeric),
    decrease_collateral_amount_native: decimalOrZero(
      r.decrease_collateral_amount_native as RawNumeric,
    ),
    close_collateral_amount: decimalOrZero(r.close_collateral_amount as RawNumeric),
    close_collateral_amount_native: decimalOrZero(
      r.close_collateral_amount_native as RawNumeric,
    ),
    collateral_amount: decimalOrZero(r.collateral_amount as RawNumeric),
    collateral_amount_native: decimalOrZero(r.collateral_amount_native as RawNumeric),
    exit_amount_native: decimalOrNull(r.exit_amount_native as RawNumeric),

    closed_by_sl_tp: Boolean(r.closed_by_sl_tp),

    volume: decimalOrZero(r.volume as RawNumeric),
    duration: r.duration == null ? null : Number(r.duration),

    pnl_volume_ratio: decimalOrNull(r.pnl_volume_ratio as RawNumeric),
    points_pnl_volume_ratio: decimalOrNull(r.points_pnl_volume_ratio as RawNumeric),
    points_duration: decimalOrNull(r.points_duration as RawNumeric),
    close_size_multiplier: decimalOrNull(r.close_size_multiplier as RawNumeric),
    points_mutations: decimalOrNull(r.points_mutations as RawNumeric),
    total_points: decimalOrNull(r.total_points as RawNumeric),

    created_at: String(r.created_at),
    updated_at: String(r.updated_at),
  };
}

function parseApiTraderInfo(raw: Record<string, unknown>): ApiTraderInfo {
  const r = raw as Record<string, RawNumeric | string | null>;
  return {
    user_pubkey: String(r.user_pubkey),
    total_pnl: decimalOrZero(r.total_pnl as RawNumeric),
    total_fees: decimalOrZero(r.total_fees as RawNumeric),
    total_borrow_fees: decimalOrZero(r.total_borrow_fees as RawNumeric),
    total_exit_fees: decimalOrZero(r.total_exit_fees as RawNumeric),
    total_volume: decimalOrZero(r.total_volume as RawNumeric),
    total_number_positions: Number(r.total_number_positions),
    total_number_positions_open: Number(r.total_number_positions_open),
    total_number_positions_closed: Number(r.total_number_positions_closed),
    total_number_positions_liquidated: Number(r.total_number_positions_liquidated),
    win_rate_percentage: decimalOrZero(r.win_rate_percentage as RawNumeric),
    largest_winning_trade: decimalOrZero(r.largest_winning_trade as RawNumeric),
    largest_losing_trade: decimalOrZero(r.largest_losing_trade as RawNumeric),
    best_trading_performance: decimalOrZero(r.best_trading_performance as RawNumeric),
    worst_trading_performance: decimalOrZero(r.worst_trading_performance as RawNumeric),
    avg_win_pnl: decimalOrZero(r.avg_win_pnl as RawNumeric),
    avg_loss_pnl: decimalOrZero(r.avg_loss_pnl as RawNumeric),
    avg_volume: decimalOrZero(r.avg_volume as RawNumeric),
    avg_pnl: decimalOrZero(r.avg_pnl as RawNumeric),
    avg_fees: decimalOrZero(r.avg_fees as RawNumeric),
    avg_borrow_fees: decimalOrZero(r.avg_borrow_fees as RawNumeric),
    avg_trading_performance: decimalOrZero(r.avg_trading_performance as RawNumeric),
    avg_entry_leverage: decimalOrZero(r.avg_entry_leverage as RawNumeric),
    avg_entry_size: decimalOrZero(r.avg_entry_size as RawNumeric),
    avg_exit_size: decimalOrZero(r.avg_exit_size as RawNumeric),
    avg_entry_collateral_amount: decimalOrZero(r.avg_entry_collateral_amount as RawNumeric),
    avg_holding_time: decimalOrZero(r.avg_holding_time as RawNumeric),
  };
}

// ---------------------------------------------------------------------------
// HTTP plumbing
// ---------------------------------------------------------------------------

export class AdrenaDatapiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly endpoint: string,
  ) {
    super(message);
    this.name = "AdrenaDatapiError";
  }
}

interface RequestOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
}

async function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    if (signal) {
      const onAbort = () => {
        clearTimeout(t);
        reject(new DOMException("Aborted", "AbortError"));
      };
      if (signal.aborted) onAbort();
      else signal.addEventListener("abort", onAbort, { once: true });
    }
  });
}

function joinAbortSignals(
  external: AbortSignal | undefined,
  timeout: AbortSignal,
): AbortSignal {
  if (!external) return timeout;
  const ctrl = new AbortController();
  const onAbort = (reason: unknown) => ctrl.abort(reason);
  if (external.aborted) ctrl.abort(external.reason);
  else external.addEventListener("abort", () => onAbort(external.reason), { once: true });
  if (timeout.aborted) ctrl.abort(timeout.reason);
  else timeout.addEventListener("abort", () => onAbort(timeout.reason), { once: true });
  return ctrl.signal;
}

async function getJson<T>(
  endpoint: string,
  searchParams: URLSearchParams,
  opts: RequestOptions,
): Promise<T> {
  const url = `${getBaseUrl()}${endpoint}?${searchParams.toString()}`;
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  let lastError: Error | null = null;
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    const timeoutCtrl = new AbortController();
    const timer = setTimeout(() => timeoutCtrl.abort(), timeoutMs);
    const signal = joinAbortSignals(opts.signal, timeoutCtrl.signal);

    let response: Response;
    try {
      response = await fetch(url, {
        method: "GET",
        headers: { Accept: "application/json" },
        signal,
      });
    } catch (err) {
      clearTimeout(timer);
      if ((err as Error).name === "AbortError") throw err;
      lastError = err as Error;
      // Network-level error — retry like a 5xx.
      if (attempt < RETRY_DELAYS_MS.length) {
        await sleep(RETRY_DELAYS_MS[attempt], opts.signal);
        continue;
      }
      throw new AdrenaDatapiError(
        `network error: ${(err as Error).message}`,
        0,
        endpoint,
      );
    }
    clearTimeout(timer);

    if (response.ok) {
      return (await response.json()) as T;
    }

    const status = response.status;
    const retryable = status === 429 || (status >= 500 && status < 600);

    // Drain the body (status-only logging — never the bytes).
    try {
      await response.text();
    } catch {
      /* ignore */
    }

    if (retryable && attempt < RETRY_DELAYS_MS.length) {
      console.warn(
        `[adrena-datapi] ${endpoint} → ${status}, retry ${attempt + 1}/${RETRY_DELAYS_MS.length} in ${RETRY_DELAYS_MS[attempt]}ms`,
      );
      await sleep(RETRY_DELAYS_MS[attempt], opts.signal);
      continue;
    }

    throw new AdrenaDatapiError(`HTTP ${status}`, status, endpoint);
  }

  // Should be unreachable — the loop either returns, throws, or continues.
  throw lastError ??
    new AdrenaDatapiError("exhausted retries", 0, endpoint);
}

// ---------------------------------------------------------------------------
// Public endpoints
// ---------------------------------------------------------------------------

export interface FetchPositionsOptions extends RequestOptions {
  status?: PositionStatus[];
  side?: PositionSide;
  position_id?: number;
  entry_date?: string;
  exit_date?: string;
  sort?: "ASC" | "DESC";
  sortField?:
    | "entry_date"
    | "exit_date"
    | "position_id"
    | "pnl"
    | "volume"
    | "collateral_amount"
    | "fees";
  limit?: number;
  offset?: number;
}

export async function fetchPositions(
  userWallet: string,
  options: FetchPositionsOptions = {},
): Promise<ApiPositionsEnvelope> {
  const params = new URLSearchParams();
  params.set("user_wallet", userWallet);
  if (options.status?.length) {
    for (const s of options.status) params.append("status", s);
  }
  if (options.side) params.set("side", options.side);
  if (options.position_id !== undefined)
    params.set("position_id", String(options.position_id));
  if (options.entry_date) params.set("entry_date", options.entry_date);
  if (options.exit_date) params.set("exit_date", options.exit_date);
  if (options.sort) params.set("sort", options.sort);
  if (options.sortField) params.set("sortField", options.sortField);
  if (options.limit !== undefined) params.set("limit", String(options.limit));
  if (options.offset !== undefined) params.set("offset", String(options.offset));

  const body = await getJson<{ success: boolean; data: ApiPositionsEnvelope }>(
    "/v4/position",
    params,
    options,
  );

  const data = body.data;
  const parsed: ApiPositionsEnvelope = {
    positions: (data.positions ?? []).map((raw) =>
      parseApiPosition(raw as unknown as Record<string, unknown>),
    ),
    offset: Number(data.offset ?? 0),
    limit: Number(data.limit ?? 0),
    total_count: Number(data.total_count ?? data.positions?.length ?? 0),
    pool_name: data.pool_name ?? null,
  };
  console.log(
    `[adrena-datapi] fetchPositions wallet=${redact(userWallet)} count=${parsed.positions.length} total=${parsed.total_count}`,
  );
  return parsed;
}

/**
 * Resolve a transaction signature → {user_wallet, position_id, method, side}.
 *
 * **UNVERIFIED — pending sample request from Adrena team.** As of build time
 * this endpoint returns 400 for every signature we've thrown at it, including
 * Phase 1 verified close sigs and fresh `last_ix` values from successful
 * /v4/position rows. The endpoint exists (returns Adrena's own error envelope,
 * not Fastify's default) but rejects the input shape. Manual-claim
 * verification depends on this — auto-claim via WebSocket does not, so we are
 * not blocked on Phase 2 progress. Re-test once br0wnD3v shares a known-good
 * sample.
 */
export async function fetchPositionBySignature(
  signature: string,
  options: RequestOptions = {},
): Promise<ApiTransactionPosition> {
  const params = new URLSearchParams();
  params.set("signature", signature);
  const body = await getJson<{ success: boolean; data: ApiTransactionPosition }>(
    "/transaction-position",
    params,
    options,
  );
  const d = body.data;
  return {
    position_id: Number(d.position_id),
    method: String(d.method),
    transaction_date: String(d.transaction_date),
    slot: Number(d.slot),
    side: d.side as PositionSide,
    user_wallet: String(d.user_wallet),
  };
}

export async function fetchTraderInfo(
  userWallet: string,
  options: RequestOptions = {},
): Promise<ApiTraderInfo> {
  const params = new URLSearchParams();
  params.set("user_wallet", userWallet);
  const body = await getJson<{ success: boolean; data: Record<string, unknown> }>(
    "/trader-info",
    params,
    options,
  );
  return parseApiTraderInfo(body.data);
}

export async function fetchTraderProfiles(
  wallets: string[],
  options: RequestOptions = {},
): Promise<ApiTraderProfile[]> {
  const params = new URLSearchParams();
  for (const w of wallets) params.append("wallets", w);
  const body = await getJson<{ success: boolean; data: Array<Record<string, unknown>> }>(
    "/trader-profiles",
    params,
    options,
  );
  return (body.data ?? []).map((row) => {
    const r = row as Record<string, RawNumeric | string | null>;
    return {
      ...row,
      user_wallet: String(r.user_wallet),
      nickname: r.nickname == null ? null : String(r.nickname),
      total_volume: decimalOrZero(r.total_volume as RawNumeric),
    } as ApiTraderProfile;
  });
}

export async function fetchTraderVolume(
  startDate: string,
  endDate: string,
  options: RequestOptions = {},
): Promise<ApiTraderVolumeRow[]> {
  const params = new URLSearchParams();
  params.set("start_date", startDate);
  params.set("end_date", endDate);
  const body = await getJson<{ success: boolean; data: Array<Record<string, unknown>> }>(
    "/trader-volume",
    params,
    options,
  );
  return (body.data ?? []).map((row) => {
    const r = row as Record<string, RawNumeric | string>;
    return {
      user_wallet: String(r.user_wallet),
      volume_usd: decimalOrZero(r.volume_usd as RawNumeric),
      trades_count: Number(r.trades_count),
    };
  });
}

// ---------------------------------------------------------------------------
// Logging helpers
// ---------------------------------------------------------------------------

function redact(wallet: string): string {
  if (wallet.length <= 8) return wallet;
  return `${wallet.slice(0, 4)}…${wallet.slice(-4)}`;
}

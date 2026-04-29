// Thin client for the gated Adrena competition data service at
// https://adrena-competition-service.onrender.com. Documented in docs/ROUTES.md.
//
// Conventions enforced here:
//  - The API key is carried in the URL path, not in a header. We fail loudly
//    at module load if ADRENA_COMPETITION_API_KEY is missing — every call
//    would 401 silently otherwise.
//  - Field shapes match ROUTES.md verbatim (camelCase here because that's
//    the wire format, unlike datapi which is snake_case).
//  - USD numerics get wrapped in Decimal at the boundary. The size-multiplier
//    table is small (8 tiers) and static, but mutagen scoring math runs through
//    these values, so we don't want JS-float surprises.
//  - Render free tier sleeps after ~15 min of inactivity. First request after
//    sleep can take 30-60s. Callers expecting cold start should give a generous
//    timeout.

import { Decimal } from "decimal.js";

const DEFAULT_BASE_URL = "https://adrena-competition-service.onrender.com";
const DEFAULT_TIMEOUT_MS = 60_000; // wide for Render cold starts; tighten on hot calls
const RETRY_DELAYS_MS = [500, 1_000, 2_000] as const;

function getApiKey(): string {
  const key = process.env.ADRENA_COMPETITION_API_KEY;
  if (!key) {
    throw new Error(
      "ADRENA_COMPETITION_API_KEY is not set. The competition service requires the key in the URL path; without it every request returns 401.",
    );
  }
  return key;
}

function getBaseUrl(): string {
  return process.env.ADRENA_COMPETITION_BASE_URL ?? DEFAULT_BASE_URL;
}

// ---------------------------------------------------------------------------
// Domain types — matching ROUTES.md.
// ---------------------------------------------------------------------------

export interface HealthResponse {
  status: string;
  timestamp: number; // ms since epoch
}

export interface SizeMultiplierTier {
  minSize: Decimal;
  maxSize: Decimal;
  multiplierMin: Decimal;
  multiplierMax: Decimal;
}

export interface SizeMultiplierTable {
  tiers: SizeMultiplierTier[];
  interpolation: string;
  formula: string;
  notes: string[];
}

export interface SizeMultiplierResult {
  sizeUsd: Decimal;
  multiplier: Decimal;
  tier: SizeMultiplierTier | null;
}

// position-schema is largely IDL passthrough — preserve the raw shape for
// callers that want to inspect discriminators or field layouts. We don't
// promise field-by-field stability since it's literally re-served from the
// pinned @adrena/abi IDL.
export interface PositionSchemaResponse {
  programId: string;
  idlSource: string;
  idlVersion: string;
  idlName: string;
  note: string;
  positionAccount: Record<string, unknown>;
  closePositionEvent: Record<string, unknown>;
  liquidateEvent: Record<string, unknown>;
  openPositionEvent: Record<string, unknown>;
  increasePositionEvent: Record<string, unknown>;
  decoding: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// HTTP plumbing
// ---------------------------------------------------------------------------

export class AdrenaCompetitionError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly endpoint: string,
  ) {
    super(message);
    this.name = "AdrenaCompetitionError";
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
  searchParams: URLSearchParams | null,
  opts: RequestOptions,
): Promise<T> {
  const apiKey = getApiKey();
  const qs = searchParams && [...searchParams.keys()].length > 0 ? `?${searchParams}` : "";
  const url = `${getBaseUrl()}/${apiKey}${endpoint}${qs}`;
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
      if (attempt < RETRY_DELAYS_MS.length) {
        await sleep(RETRY_DELAYS_MS[attempt], opts.signal);
        continue;
      }
      throw new AdrenaCompetitionError(
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

    try {
      await response.text();
    } catch {
      /* ignore */
    }

    if (retryable && attempt < RETRY_DELAYS_MS.length) {
      console.warn(
        `[adrena-competition] ${endpoint} → ${status}, retry ${attempt + 1}/${RETRY_DELAYS_MS.length} in ${RETRY_DELAYS_MS[attempt]}ms`,
      );
      await sleep(RETRY_DELAYS_MS[attempt], opts.signal);
      continue;
    }

    if (status === 401) {
      throw new AdrenaCompetitionError(
        "401 Unauthorized — ADRENA_COMPETITION_API_KEY may be wrong or rotated",
        status,
        endpoint,
      );
    }

    throw new AdrenaCompetitionError(`HTTP ${status}`, status, endpoint);
  }

  throw lastError ??
    new AdrenaCompetitionError("exhausted retries", 0, endpoint);
}

// ---------------------------------------------------------------------------
// Public endpoints
// ---------------------------------------------------------------------------

export async function healthCheck(
  options: RequestOptions = {},
): Promise<HealthResponse> {
  const body = await getJson<HealthResponse>("/health", null, options);
  console.log(
    `[adrena-competition] health status=${body.status} ts=${body.timestamp}`,
  );
  return {
    status: String(body.status),
    timestamp: Number(body.timestamp),
  };
}

function parseTier(raw: Record<string, unknown>): SizeMultiplierTier {
  const r = raw as Record<string, number | string>;
  return {
    minSize: new Decimal(r.minSize),
    maxSize: new Decimal(r.maxSize),
    multiplierMin: new Decimal(r.multiplierMin),
    multiplierMax: new Decimal(r.multiplierMax),
  };
}

export async function fetchSizeMultiplierTable(
  options: RequestOptions = {},
): Promise<SizeMultiplierTable> {
  const body = await getJson<{
    tiers: Array<Record<string, unknown>>;
    interpolation: string;
    formula: string;
    notes: string[];
  }>("/size-multiplier", null, options);

  const tiers = (body.tiers ?? []).map(parseTier);
  console.log(
    `[adrena-competition] size-multiplier table tiers=${tiers.length}`,
  );
  return {
    tiers,
    interpolation: String(body.interpolation),
    formula: String(body.formula),
    notes: (body.notes ?? []).map(String),
  };
}

export async function calculateSizeMultiplier(
  sizeUsd: number | string | Decimal,
  options: RequestOptions = {},
): Promise<SizeMultiplierResult> {
  const params = new URLSearchParams();
  // Endpoint expects a plain number; Decimal → string via toFixed avoids
  // exponential notation that the server may not parse.
  const sizeAsString =
    sizeUsd instanceof Decimal ? sizeUsd.toFixed() : String(sizeUsd);
  params.set("size", sizeAsString);

  const body = await getJson<{
    sizeUsd: number | string;
    multiplier: number | string;
    tier: Record<string, unknown> | null;
  }>("/size-multiplier/calculate", params, options);

  return {
    sizeUsd: new Decimal(body.sizeUsd),
    multiplier: new Decimal(body.multiplier),
    tier: body.tier ? parseTier(body.tier) : null,
  };
}

export async function fetchPositionSchema(
  options: RequestOptions = {},
): Promise<PositionSchemaResponse> {
  const body = await getJson<PositionSchemaResponse>(
    "/position-schema",
    null,
    options,
  );
  return body;
}

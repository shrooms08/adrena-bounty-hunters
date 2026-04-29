# Adrena Competition — Route Reference

Complete request/response reference for the gated Adrena competition data service. Two surfaces:

- **REST** — static helpers (size-multiplier table, IDL schema, health, index).
- **WebSocket** — live program stream (Position account writes, close events, liquidations).

Every route is gated behind a single API key carried in the URL path. No header auth, no query token. Internal infrastructure (Yellowstone gRPC endpoint, x-tokens, mainnet RPC, source IDL files) never leaves the server.

---

## Base URL

```
HTTP:  https://adrena-competition-service.onrender.com/<API_KEY>/<endpoint>
WS:    wss://adrena-competition-service.onrender.com/<API_KEY>
```

The service is deployed at **`adrena-competition-service.onrender.com`**. Replace `<API_KEY>` in every example with the shared key below.

## API key

```
4dr3n4-n0v3l-7r4ding-4nd-g4m3s-id34-b0un7y
```

This is the single shared key. Provide it to every competition participant. Without it, every REST call returns `401` and every WebSocket connection is rejected at the handshake.

> Rotation: edit `API_KEY` in [src/middleware/api-key.ts](src/middleware/api-key.ts) and redeploy. The compare uses `crypto.timingSafeEqual` so a length mismatch is rejected before any byte comparison.

---

# REST Endpoints

All REST endpoints are `GET`. Responses are JSON. Cache headers are set per-route (see each entry).

## `GET /<API_KEY>/`

Service index — lists every endpoint, the program id (sourced from `@adrena/abi`), and a one-line description for each. Useful as a "is the service up + which key am I on" probe.

**Request:**

```bash
curl 'https://adrena-competition-service.onrender.com/4dr3n4-n0v3l-7r4ding-4nd-g4m3s-id34-b0un7y/'
```

**Response (200):**

```json
{
  "service": "Adrena Competition Data Service",
  "programId": "13gDzEXCdocbj8iAiqrScGo47NiSuYENGsRqi3SEAwet",
  "endpoints": {
    "GET /:apiKey/": "This index",
    "GET /:apiKey/health": "Health check",
    "GET /:apiKey/size-multiplier": "Full size multiplier lookup table with tiers and mutagen formula",
    "GET /:apiKey/size-multiplier/calculate?size=50000": "Calculate multiplier for a specific USD size",
    "GET /:apiKey/position-schema": "Position PDA struct layout, closePosition fields, and realized PnL documentation",
    "WebSocket ws://host/:apiKey": "Real-time Adrena program account & transaction stream (sanitized Yellowstone gRPC relay)"
  }
}
```

**Cache:** `public, max-age=300` (5 min).

---

## `GET /<API_KEY>/health`

Liveness probe. No DB hit, no upstream RPC.

**Request:**

```bash
curl 'https://adrena-competition-service.onrender.com/4dr3n4-n0v3l-7r4ding-4nd-g4m3s-id34-b0un7y/health'
```

**Response (200):**

```json
{
  "status": "ok",
  "timestamp": 1730000000000
}
```

`timestamp` is `Date.now()` server-side at request time (milliseconds since epoch).

**Cache:** none.

---

## `GET /<API_KEY>/size-multiplier`

Full off-chain mutagen size-multiplier table — every tier, the linear-interpolation formula, and the boundary rules. Use this once at startup to embed the curve in your scoring logic.

**Request:**

```bash
curl 'https://adrena-competition-service.onrender.com/4dr3n4-n0v3l-7r4ding-4nd-g4m3s-id34-b0un7y/size-multiplier'
```

**Response (200):**

```json
{
  "tiers": [
    { "minSize": 10,         "maxSize": 1000,    "multiplierMin": 0.00025, "multiplierMax": 0.05 },
    { "minSize": 1000,       "maxSize": 5000,    "multiplierMin": 0.05,    "multiplierMax": 1 },
    { "minSize": 5000,       "maxSize": 50000,   "multiplierMin": 1,       "multiplierMax": 5 },
    { "minSize": 50000,      "maxSize": 100000,  "multiplierMin": 5,       "multiplierMax": 9 },
    { "minSize": 100000,     "maxSize": 250000,  "multiplierMin": 9,       "multiplierMax": 17.5 },
    { "minSize": 250000,     "maxSize": 500000,  "multiplierMin": 17.5,    "multiplierMax": 25 },
    { "minSize": 500000,     "maxSize": 1000000, "multiplierMin": 25,      "multiplierMax": 30 },
    { "minSize": 1000000,    "maxSize": 4500000, "multiplierMin": 30,      "multiplierMax": 45 }
  ],
  "interpolation": "linear",
  "formula": "multiplierMin + ((sizeUsd - minSize) * (multiplierMax - multiplierMin)) / (maxSize - minSize)",
  "notes": [
    "sizeUsd is the close size in USD",
    "Multiplier increases linearly within each tier",
    "Below $10 or above $4.5M returns 0",
    "This table is computed off-chain — the on-chain program does not use it"
  ]
}
```

**Cache:** `public, max-age=300` (5 min). The table is static — no need to re-fetch frequently.

---

## `GET /<API_KEY>/size-multiplier/calculate?size=<usd>`

One-shot lookup for a specific USD close size. Returns the interpolated multiplier and the tier it landed in. Convenient when you don't want to ship the full table to the client.

**Required:** `size` (USD, non-negative number).

**Request:**

```bash
curl 'https://adrena-competition-service.onrender.com/4dr3n4-n0v3l-7r4ding-4nd-g4m3s-id34-b0un7y/size-multiplier/calculate?size=75000'
```

**Response (200):**

```json
{
  "sizeUsd": 75000,
  "multiplier": 7,
  "tier": {
    "minSize": 50000,
    "maxSize": 100000,
    "multiplierMin": 5,
    "multiplierMax": 9
  }
}
```

For sizes outside the table (`< 10` or `>= 4_500_000`) the response still returns `200`, with `multiplier: 0` and `tier: null`.

**Errors:**

| Status | Body | When |
|---|---|---|
| `400` | `{"error":"Missing required query parameter: size (USD amount)"}` | `?size=` not provided |
| `400` | `{"error":"size must be a non-negative number"}` | `size` not parseable / negative |
| `429` | `{"error":"Too many calculate requests, please try again later."}` | per-IP cap exceeded (30 req/min) |

**Cache:** `public, max-age=300` (5 min) — caller's IP-keyed cap is the more frequent throttle in practice.

**Rate limit:** **30 req/min per IP** (stricter than the global 60 req/min — `/calculate` does the most CPU work).

---

## `GET /<API_KEY>/position-schema`

Serves the canonical Adrena program metadata, sliced live from the pinned `@adrena/abi/idl/adrena.json`. The service does **not** maintain a local copy of byte offsets, discriminator constants, or struct definitions — every byte you receive here is whatever the IDL pinned in `package.json` says. Bumping the pin (and redeploying) updates this response automatically.

**Request:**

```bash
curl 'https://adrena-competition-service.onrender.com/4dr3n4-n0v3l-7r4ding-4nd-g4m3s-id34-b0un7y/position-schema'
```

**Response (200):**

```json
{
  "programId": "13gDzEXCdocbj8iAiqrScGo47NiSuYENGsRqi3SEAwet",
  "idlSource": "@adrena/abi/idl/adrena.json",
  "idlVersion": "2.1.0",
  "idlName": "adrena",
  "note": "All struct/event metadata below is served verbatim from the pinned @adrena/abi IDL. The competition service no longer maintains a local copy. To upgrade, bump the @adrena/abi version in package.json.",
  "positionAccount": {
    "name": "Position",
    "discriminator": [170, 188, 143, 228, 122, 64, 247, 208],
    "serialization": "bytemuck",
    "repr": { "kind": "c" },
    "fields": [
      { "name": "bump",                              "type": "u8" },
      { "name": "side",                              "type": "u8" },
      { "name": "take_profit_is_set",                "type": "u8" },
      { "name": "stop_loss_is_set",                  "type": "u8" },
      { "name": "_padding_unsafe",                   "type": { "array": ["u8", 1] } },
      { "name": "_padding",                          "type": { "array": ["u8", 3] } },
      { "name": "owner",                             "type": "pubkey" },
      { "name": "pool",                              "type": "pubkey" },
      { "name": "custody",                           "type": "pubkey" },
      { "name": "collateral_custody",                "type": "pubkey" },
      { "name": "open_time",                         "type": "i64" },
      { "name": "update_time",                       "type": "i64" },
      { "name": "price",                             "type": "u64" },
      { "name": "size_usd",                          "type": "u64" },
      { "name": "borrow_size_usd",                   "type": "u64" },
      { "name": "collateral_usd",                    "type": "u64" },
      { "name": "unrealized_interest_usd",           "type": "u64" },
      { "name": "cumulative_interest_snapshot",      "type": { "defined": { "name": "U128Split" } } },
      { "name": "locked_amount",                     "type": "u64" },
      { "name": "collateral_amount",                 "type": "u64" },
      { "name": "exit_fee_usd",                      "type": "u64" },
      { "name": "liquidation_fee_usd",               "type": "u64" },
      { "name": "id",                                "type": "u64" },
      { "name": "take_profit_limit_price",           "type": "u64" },
      { "name": "paid_interest_usd",                 "type": "u64" },
      { "name": "stop_loss_limit_price",             "type": "u64" },
      { "name": "stop_loss_close_position_price",    "type": "u64" },
      { "name": "cumulative_long_to_short_snapshot", "type": { "defined": { "name": "U128Split" } } },
      { "name": "cumulative_short_to_long_snapshot", "type": { "defined": { "name": "U128Split" } } },
      { "name": "unrealized_funding_paid_usd",       "type": "u64" },
      { "name": "unrealized_funding_received_usd",   "type": "u64" },
      { "name": "_reserved",                         "type": { "array": [{ "array": ["u8", 32] }, 4] } }
    ]
  },
  "closePositionEvent": {
    "name": "ClosePositionEvent",
    "discriminator": [198, 217, 115, 95, 191, 120, 142, 137],
    "fields": [
      { "name": "owner",                 "type": "pubkey" },
      { "name": "position",              "type": "pubkey" },
      { "name": "custody_mint",          "type": "pubkey" },
      { "name": "custody_seed",          "type": { "array": ["u8", 32] } },
      { "name": "side",                  "type": "u8" },
      { "name": "size_usd",              "type": "u64" },
      { "name": "price",                 "type": "u64" },
      { "name": "collateral_amount_usd", "type": "u64" },
      { "name": "profit_usd",            "type": "u64" },
      { "name": "loss_usd",              "type": "u64" },
      { "name": "borrow_fee_usd",        "type": "u64" },
      { "name": "exit_fee_usd",          "type": "u64" },
      { "name": "position_id",           "type": "u64" },
      { "name": "percentage",            "type": "u64" },
      { "name": "funding_paid_usd",      "type": "u64" },
      { "name": "funding_received_usd",  "type": "u64" },
      { "name": "pool_type",             "type": "u8" }
    ]
  },
  "liquidateEvent": {
    "name": "LiquidateEvent",
    "discriminator": [158, 94, 144, 4, 147, 52, 5, 255],
    "fields": [
      { "name": "owner",                 "type": "pubkey" },
      { "name": "position",              "type": "pubkey" },
      { "name": "custody_mint",          "type": "pubkey" },
      { "name": "custody_seed",          "type": { "array": ["u8", 32] } },
      { "name": "side",                  "type": "u8" },
      { "name": "size_usd",              "type": "u64" },
      { "name": "price",                 "type": "u64" },
      { "name": "collateral_amount_usd", "type": "u64" },
      { "name": "loss_usd",              "type": "u64" },
      { "name": "borrow_fee_usd",        "type": "u64" },
      { "name": "exit_fee_usd",          "type": "u64" },
      { "name": "liquidation_fee_usd",   "type": "u64" },
      { "name": "position_id",           "type": "u64" },
      { "name": "funding_paid_usd",      "type": "u64" },
      { "name": "funding_received_usd",  "type": "u64" },
      { "name": "pool_type",             "type": "u8" }
    ]
  },
  "openPositionEvent":     { "name": "OpenPositionEvent",     "discriminator": [/* … */], "fields": [/* … */] },
  "increasePositionEvent": { "name": "IncreasePositionEvent", "discriminator": [/* … */], "fields": [/* … */] },
  "decoding": {
    "events": "Anchor events are emitted as `Program data: <base64>` log lines. Decode via `BorshEventCoder` from @coral-xyz/anchor seeded with the @adrena/abi IDL — no manual byte slicing needed.",
    "account": "Position is a `repr(c)` zero_copy account. Decode via `BorshAccountsCoder.decode('Position', dataBuffer)` (skip first 8 discriminator bytes) using the same IDL.",
    "usdScale": "All u64 USD fields use 6-decimal precision (1_000_000 = $1.00). Divide raw values by 1e6 to convert to dollars."
  }
}
```

**Cache:** `public, max-age=300` (5 min).

---

## REST error envelope

When a REST call fails before reaching its handler (auth, rate-limit, 404, internal):

| Status | Body |
|---|---|
| `401` | `{"error":"Invalid or missing API key"}` |
| `404` | `{"error":"Not found"}` |
| `429` | `{"error":"Too many requests, please try again later."}` (`/calculate` returns the calculate-specific message) |
| `500` | `{"error":"Internal server error"}` (no stack trace leak) |

---

# WebSocket Endpoint

## `wss://adrena-competition-service.onrender.com/<API_KEY>`

Single WebSocket endpoint. The server pushes messages — clients should not send anything except occasional pings (incoming messages > 10/heartbeat-interval → terminate).

```javascript
const ws = new WebSocket('wss://adrena-competition-service.onrender.com/4dr3n4-n0v3l-7r4ding-4nd-g4m3s-id34-b0un7y');

ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  switch (msg.type) {
    case 'info':             /* welcome banner — log once */          break;
    case 'position_account': handlePositionWrite(msg);                 break;
    case 'close_position':   handleClose(msg);                         break;
    case 'liquidate':        handleLiquidation(msg);                   break;
    case 'ping':             /* keepalive — no action needed */        break;
  }
};
```

> **No replay or backfill.** This is a live stream. If you disconnect, anything that happened while you were offline is gone. Persist what you need to your own storage.

### Connection rejection codes

| Code | Reason |
|---|---|
| Connection refused at handshake | Invalid API key in URL path |
| `1013` `Server at capacity` | Global cap of `MAX_WS_CONNECTIONS_GLOBAL` (default 100) reached |
| `1013` `Too many connection attempts` | > 5 connect attempts/minute from your IP |
| `1013` `Too many connections from this IP` | > `MAX_WS_CONNECTIONS_PER_IP` (default 3) |
| Terminated mid-session | Did not respond to ping (~30 s idle) OR sent > 10 messages per heartbeat interval OR sent > 1 KB in any single frame |

---

## Message: `info`

Emitted **once**, immediately after the handshake. Carries the program id, an index of message types, the field-naming conventions, and the upstream subscription shape.

```json
{
  "type": "info",
  "programId": "13gDzEXCdocbj8iAiqrScGo47NiSuYENGsRqi3SEAwet",
  "message": "Connected to Adrena competition gRPC relay. This is a live stream only — no data is stored server-side. If you disconnect, missed events are gone. It is your responsibility to persist any data you need (database, files, etc.).",
  "messageTypes": {
    "position_account": "Position account write — fired on open / increase / decrease / collateral move / close / liquidate. ...",
    "close_position":   "Trader-initiated close. `decoded` is the ClosePositionEvent ...",
    "liquidate":        "Forced liquidation. `decoded` is the LiquidateEvent ...",
    "info":             "Service-level message (this banner).",
    "ping":             "Periodic keepalive."
  },
  "conventions": {
    "fieldCasing": "All decoded fields are snake_case, matching the canonical Adrena IDL ...",
    "usdScale":    "u64 USD fields use 6 decimals (1_000_000 = $1.00). Divide by 1e6.",
    "bigInts":     "BN values are emitted as decimal strings to avoid JS precision loss. Pubkeys are base58."
  },
  "subscription": {
    "accounts": {
      "owner": "13gDzEXCdocbj8iAiqrScGo47NiSuYENGsRqi3SEAwet",
      "discriminatorFilter": "Position anchor discriminator (first 8 bytes)"
    },
    "transactions": {
      "accountInclude": ["13gDzEXCdocbj8iAiqrScGo47NiSuYENGsRqi3SEAwet"],
      "vote": false,
      "failed": false,
      "relayedTags": ["ClosePositionLong/Short", "LiquidateLong/Short"]
    }
  }
}
```

---

## Message: `position_account`

**Fires on every Adrena Position account write** — open, increase, decrease, collateral move, partial close, full close, liquidate. The relay filters by the Position-account discriminator before broadcasting; Cortex / Custody / Pool / Staking / etc. are dropped silently.

```json
{
  "type": "position_account",
  "filter": "positions",
  "timestamp": 1730000000000,
  "raw": {
    "pubkey": "4tvwPDX1z5SCaAehTBCzgABUZKbHa52DEiPFASK9HRHq",
    "slot": "302587419",
    "lamports": "2039280",
    "is_closed": false,
    "data_length": 472,
    "is_startup": false
  },
  "decoded": {
    "bump": 254,
    "side": 1,
    "take_profit_is_set": 0,
    "stop_loss_is_set": 0,
    "_padding_unsafe": [0],
    "_padding": [0, 0, 0],
    "owner": "4C9smecZcqEvALzmmgWsDd9w3JHPdVZAEUW86V3oayPx",
    "pool": "4bQRutgDJs6vuh6ZcWaPVXiQaBzbHketjbCDjL4WaRN34",
    "custody": "EkcJgWE3y9dN7WdmqEzTdN1V9D2W8e8Xb9Lq8e2YnG3a",
    "collateral_custody": "9aeY8aQ9WhTDCt6sX6Eb1Fc8YQX3JgLgEpL7p6eEdN1Y",
    "open_time": "1729900000",
    "update_time": "1730000000",
    "price": "98844483",
    "size_usd": "99255642",
    "borrow_size_usd": "89330078",
    "collateral_usd": "9925564",
    "unrealized_interest_usd": "1234",
    "cumulative_interest_snapshot": { "high": "0", "low": "1234567890" },
    "locked_amount": "1009205700",
    "collateral_amount": "100920570",
    "exit_fee_usd": "5678",
    "liquidation_fee_usd": "12000",
    "id": "108432",
    "take_profit_limit_price": "0",
    "paid_interest_usd": "0",
    "stop_loss_limit_price": "0",
    "stop_loss_close_position_price": "0",
    "cumulative_long_to_short_snapshot": { "high": "0", "low": "0" },
    "cumulative_short_to_long_snapshot": { "high": "0", "low": "0" },
    "unrealized_funding_paid_usd": "0",
    "unrealized_funding_received_usd": "0",
    "_reserved": [/* 4 × 32-byte zero arrays */]
  }
}
```

### Field semantics

| Field | Notes |
|---|---|
| `raw.pubkey` | Position PDA (base58) — stable identity for this position. |
| `raw.slot` | Solana slot of the account write. Decimal string. |
| `raw.lamports` | Account lamports. `"0"` ⇒ account just got closed. |
| `raw.is_closed` | Convenience flag (true when `lamports === "0"`). Drop the position from your live tracker on this signal. |
| `raw.is_startup` | `true` if this update came from a Yellowstone startup snapshot rather than a live event. Most clients can ignore — treat both identically. |
| `decoded.side` | `0` = None (initial state), `1` = Long, `2` = Short. |
| `decoded.owner` | Trader wallet (base58). |
| `decoded.price` | Entry price, USD scaled by 1e6. |
| `decoded.size_usd` | Position size, USD scaled by 1e6. |
| `decoded.collateral_usd` | Collateral notional, USD scaled by 1e6. |
| `decoded.unrealized_interest_usd` | Accrued (unpaid) borrow interest, USD scaled by 1e6. |
| `decoded.unrealized_funding_paid_usd` / `_received_usd` | Virtual-funding accumulators — subtract / add when computing PnL. |
| `decoded.id` | On-chain `Position::id` (u64) — stable across the position's lifetime. |
| `decoded.take_profit_limit_price` / `stop_loss_limit_price` | TP/SL trigger prices. `"0"` = not set. Use `take_profit_is_set` / `stop_loss_is_set` flags instead of comparing to zero (a real trigger price could conceivably be `"0"` for some assets). |

### Recipe — unrealized PnL for a long position

```javascript
const sizeUsd  = BigInt(decoded.size_usd);
const entry    = BigInt(decoded.price);              // u64 1e6-scaled
const mark     = BigInt(getMarkPriceFromPyth(symbol)); // your feed, same scale

// price-delta term — work in 1e6 scale, convert at the end
const priceDelta = (mark - entry) * sizeUsd / entry;

const interest  = BigInt(decoded.unrealized_interest_usd);
const fundPaid  = BigInt(decoded.unrealized_funding_paid_usd);
const fundRecv  = BigInt(decoded.unrealized_funding_received_usd);

const unrealizedPnlUsd1e6 =
  priceDelta - interest - fundPaid + fundRecv;

const unrealizedPnlUsd = Number(unrealizedPnlUsd1e6) / 1_000_000;
```

For a short, invert the sign of `priceDelta` (replace `(mark - entry)` with `(entry - mark)`).

---

## Message: `close_position`

Fires when a trader voluntarily closes (full or partial). `decoded` is the **`ClosePositionEvent`** with realized PnL inline.

```json
{
  "type": "close_position",
  "filter": "close_position",
  "timestamp": 1730000000000,
  "raw": {
    "signature": "PGM4ZXVKRkE4alhpdEJGS3hVOEc2eng0R1NSRzUyMTVmNDF1WExn...",
    "slot": "302587419",
    "logs": [
      "Program 13gDzEXCdocbj8iAiqrScGo47NiSuYENGsRqi3SEAwet invoke [1]",
      "Program log: Instruction: ClosePositionLong",
      "Program data: xtnzX794jonp...",
      "Program 13gDzEXCdocbj8iAiqrScGo47NiSuYENGsRqi3SEAwet success"
    ],
    "err": null
  },
  "decoded": {
    "owner": "4C9smecZcqEvALzmmgWsDd9w3JHPdVZAEUW86V3oayPx",
    "position": "4tvwPDX1z5SCaAehTBCzgABUZKbHa52DEiPFASK9HRHq",
    "custody_mint": "J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn",
    "custody_seed": [/* 32 bytes as integers 0..255 */],
    "side": 1,
    "size_usd": "99255642",
    "price": "99431234",
    "collateral_amount_usd": "9925564",
    "profit_usd": "175591",
    "loss_usd": "0",
    "borrow_fee_usd": "1234",
    "exit_fee_usd": "5678",
    "position_id": "108432",
    "percentage": "1000000",
    "funding_paid_usd": "0",
    "funding_received_usd": "0",
    "pool_type": 0
  }
}
```

### Field semantics

| Field | Notes |
|---|---|
| `raw.signature` | Base64-encoded Solana tx signature. Convert to base58 if you want to look it up on a block explorer. |
| `raw.slot` | Solana slot. |
| `raw.logs` | Full program logs from the tx (including `Program data:` lines that the relay already decoded for you). |
| `raw.err` | Always `null` for relayed messages — failed transactions are dropped at the gRPC subscribe filter. |
| `decoded.profit_usd` / `loss_usd` | Mutually exclusive — one is always `"0"`. **Net PnL** = `profit_usd - loss_usd` (USD scaled by 1e6, after borrow + funding, before exit fee). |
| `decoded.percentage` | BPS of position closed. `"1000000"` = 100% (full close), `"500000"` = 50% (partial). |
| `decoded.pool_type` | `0` = GMX-style token pool (BTC, SOL, BONK, jitoSOL). `1` = Autonom synthetic pool (commodities, equities). |
| `decoded.position_id` | On-chain `Position::id` — matches `decoded.id` on the corresponding `position_account` message. |

---

## Message: `liquidate`

Fires on forced liquidation (`LiquidateLong` / `LiquidateShort` instructions). Same envelope as `close_position` but `decoded` is the `LiquidateEvent` — no `profit_usd` field (a liquidation is always a loss), and includes `liquidation_fee_usd`.

```json
{
  "type": "liquidate",
  "filter": "liquidate",
  "timestamp": 1730000000000,
  "raw": {
    "signature": "...",
    "slot": "302587500",
    "logs": [
      "Program log: Instruction: LiquidateLong",
      "Program data: ngVeGqoGAAAA..."
    ],
    "err": null
  },
  "decoded": {
    "owner": "4C9smecZcqEvALzmmgWsDd9w3JHPdVZAEUW86V3oayPx",
    "position": "4tvwPDX1z5SCaAehTBCzgABUZKbHa52DEiPFASK9HRHq",
    "custody_mint": "J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn",
    "custody_seed": [/* 32 bytes */],
    "side": 2,
    "size_usd": "99255642",
    "price": "85431200",
    "collateral_amount_usd": "9925564",
    "loss_usd": "9923000",
    "borrow_fee_usd": "1234",
    "exit_fee_usd": "5678",
    "liquidation_fee_usd": "12000",
    "position_id": "108432",
    "funding_paid_usd": "0",
    "funding_received_usd": "0",
    "pool_type": 0
  }
}
```

### Bounty pattern — react to either close or liquidate

```javascript
ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  if (msg.type !== 'close_position' && msg.type !== 'liquidate') return;

  const { owner, position_id, profit_usd = '0', loss_usd = '0' } = msg.decoded;
  const netPnlUsd1e6 = BigInt(profit_usd) - BigInt(loss_usd);

  // Match against your bounty's wallet list, validate criteria, claim.
  if (!myBountyWallets.has(owner)) return;
  validateAndClaim({ owner, position_id, netPnlUsd1e6, kind: msg.type });
};
```

---

## Message: `ping`

Periodic keepalive emitted when the upstream Yellowstone connection is healthy but no Adrena events have happened in a while.

```json
{
  "type": "ping",
  "filter": "keepalive",
  "timestamp": 1730000000000,
  "data": {}
}
```

If no upstream gRPC endpoint is configured (degraded mode), pings carry `data: { "status": "no_upstream" }` so consumers know the relay is alive but program data is **not** flowing.

---

# Operational Notes

## Rate limits

| Surface | Limit | Source of truth |
|---|---|---|
| REST global | 60 req/min per IP | `RATE_LIMIT_MAX` env (default 60) |
| `/size-multiplier/calculate` | 30 req/min per IP | half of `RATE_LIMIT_MAX` |
| WS connections per IP | 3 concurrent | `MAX_WS_CONNECTIONS_PER_IP` env (default 3) |
| WS connections global | 100 concurrent | `MAX_WS_CONNECTIONS_GLOBAL` env (default 100) |
| WS connect attempts | 5 per minute per IP | hardcoded `CONNECTION_RATE_MAX` |
| WS message rate (incoming) | 10 per heartbeat (~30 s) | hardcoded `WS_MESSAGE_RATE_LIMIT` — exceed → terminate |
| WS frame size (incoming) | 1 KB | `MAX_MESSAGE_SIZE_BYTES` |
| WS heartbeat | 30 s | `HEARTBEAT_INTERVAL_MS` — server pings; client must pong |

`429` responses include the standard `RateLimit-*` headers.

## Cache behavior

| Endpoint | `Cache-Control` |
|---|---|
| `/` index | `public, max-age=300` |
| `/health` | _(none)_ — always fresh |
| `/size-multiplier` | `public, max-age=300` |
| `/size-multiplier/calculate` | `public, max-age=300` |
| `/position-schema` | `public, max-age=300` |
| WebSocket | n/a |

## CORS

`Access-Control-Allow-Origin: *`, methods `GET, OPTIONS`, headers `Content-Type`. `OPTIONS` preflight returns `204` directly. No credentials.

## Body size cap

REST request body is capped at **1 KB** (only matters in theory — every endpoint is `GET`).

## Slowloris protection

`headersTimeout: 20 s`, `keepAliveTimeout: 15 s` on the underlying HTTP server.

## Security headers (helmet)

CSP `default-src 'none'` + `frame-ancestors 'none'`, HSTS 1 year `includeSubDomains`. Standard hardening; no behavior change for API consumers.

## Internal infra never exposed

- Yellowstone gRPC endpoint (`GRPC_ENDPOINT`) — env-only, never logged.
- Yellowstone x-token (`GRPC_X_TOKEN`) — env-only.
- IDL / discriminator computation — server-side; consumers receive pre-decoded events.
- Server-internal env vars (`x_token`, `endpoint`, `grpc_endpoint`) — actively stripped from any field that ends up in a broadcast payload via [`SANITIZED_FIELDS`](src/grpc-relay.ts).

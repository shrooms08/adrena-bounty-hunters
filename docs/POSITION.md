# Adrena Data API — Position & Trader Reference

This document is a **trader-focused subset** of the public Adrena Data API. It documents only the endpoints needed to:

- Query a wallet's **live (open)** positions and **closed** positions.
- Inspect per-position state: collateral, size, leverage, entry/exit price, PnL, fees, dates.
- Verify a single transaction (e.g. "did this signature open a long on SOL?").
- Aggregate a trader's volume / PnL / win-rate over a date range.

It is intended as the reference for building a **bounty board** that asks traders to complete trading tasks (e.g. "open a 5×-leverage long on SOL", "trade $X volume in 7 days", "close N profitable trades") and verifies completion via the API.

Pool, liquidity, LP-token, custody, claim, staking, APR, and price endpoints are **not** included — they are not needed for the bounty-verification workflow. See the full public reference if you need them.

**Base URL:** `https://datapi.adrena.trade`

All routes are `GET`. Responses are JSON.

---

## Auth

Every endpoint in this document is public — no authentication required.

The API is rate-limited; expect `429 Too Many Requests` if you hammer it. Back off with a short retry window.

## Date filters

ISO-8601 (`2026-04-01T00:00:00Z`) or `YYYY-MM-DD` (interpreted as UTC midnight start / 23:59:59 end).

## Numeric values

NUMERIC values from the database are returned as **strings** to avoid JS precision loss. Parse to `BigNumber` / `Decimal` on your side before doing arithmetic.

## Position identifiers — read this once

A position has **three different "ids"** floating around. Don't mix them up:

| Field | Type | Meaning |
|---|---|---|
| `position_id` | integer | Database row counter. Used as the filter on `/v4/position?position_id=…` and `/position-activity?position_id=…`. |
| `position_id_onchain` | string (u64) | The on-chain `Position::id` field. Stable across DB rebuilds, but the API doesn't currently take it as a filter. |
| `pubkey` | base58 string | The Position **PDA** — the actual on-chain account address. Use this to look up the account on Solana. |

**There is no PDA → `position_id` math.** If a user gives you a Position PDA and you need its `position_id`, query `/v4/position?user_wallet=…` for that user and match by `pubkey` client-side. Or, if you have a transaction signature that touched the position, hit `/transaction-position?signature=…` and read `position_id` off the response.

---

# Positions

### `GET /v4/position`

**Primary endpoint.** Returns all positions for a wallet — open, closed, and liquidated — with full per-position state.

**Required:** `user_wallet`.
**Optional:**

- `status[]` — repeat for an IN-list, e.g. `&status=open&status=close&status=liquidate`. Values: `open`, `close`, `liquidate`.
- `side` — `long` or `short`.
- `position_id` — single-row lookup by DB id.
- `entry_date` — only positions opened ≥ this date.
- `exit_date` — only positions closed ≤ this date.
- `sort` — `ASC` / `DESC`.
- `sortField` — `entry_date`, `exit_date`, `position_id`, `pnl`, `volume`, `collateral_amount`, `fees`.
- `limit`, `offset`.

**Request — all positions for a wallet, newest exit first:**

```bash
curl 'https://datapi.adrena.trade/v4/position?user_wallet=4C9smecZcqEvALzmmgWsDd9w3JHPdVZAEUW86V3oayPx&status=open&status=close&status=liquidate&limit=200&sortField=exit_date&sort=DESC'
```

**Response:**

```json
{
  "success": true,
  "data": {
    "positions": [
      {
        "position_id": 108432,
        "user_id": 1042,
        "symbol": "JITOSOL",
        "token_account_mint": "J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn",
        "side": "long",
        "status": "open",
        "pubkey": "4tvwPDX1z5SCaAehTBCzgABUZKbHa52DEiPFASK9HRHq",
        "entry_price": 98.84448321,
        "exit_price": null,
        "entry_size": 99.255642,
        "increase_size": 0,
        "decrease_size": 0,
        "exit_size": 0,
        "entry_collateral_amount": 9.925564,
        "increase_collateral_amount": 0,
        "decrease_collateral_amount": 0,
        "close_collateral_amount": 0,
        "collateral_amount": 9.925564,
        "collateral_amount_native": 0.10092057,
        "entry_leverage": 10.143,
        "lowest_leverage": 10.143,
        "fees": null,
        "borrow_fees": null,
        "exit_fees": null,
        "pnl": null,
        "decrease_pnl": null,
        "close_pnl": null,
        "entry_date": "2026-02-23T20:12:47Z",
        "exit_date": null,
        "closed_by_sl_tp": false,
        "volume": 99.255642,
        "duration": null,
        "referrer": null
      }
    ],
    "total": 1
  }
}
```

**Field semantics — what to read for bounty verification:**

| Field | Notes |
|---|---|
| `status` | `open` = live position; `close` = trader-initiated close; `liquidate` = position liquidated. |
| `side` | `long` or `short`. |
| `symbol` | Trade symbol (`SOL`, `JITOSOL`, `BTC`, `BONK`, etc.). `JITOSOL` is priced via `SOLUSD` on-chain. |
| `entry_price` / `exit_price` | USD prices at open / final close. `exit_price` is `null` while `status = open`. |
| `entry_size` / `exit_size` / `increase_size` / `decrease_size` | USD notional sizes for each event class. |
| `entry_leverage` / `lowest_leverage` | Leverage at open and the minimum leverage observed over the position's life. |
| `entry_collateral_amount`, etc. | USD-denominated collateral at each event. `collateral_amount` is the live collateral while open. |
| `pnl` | USD realized PnL. `null` while `status = open`. Final value populated on full close / liquidate. |
| `entry_date` / `exit_date` | UTC ISO timestamps. `exit_date` is `null` while open. |
| `closed_by_sl_tp` | `true` if a stop-loss / take-profit fired the close. |
| `volume` | Sum of all USD size moves over the position (entry + increases + exit). Use this as the position's "USD volume" for volume-based bounties. |
| `duration` | Seconds the position was open. `null` while open. |

### `GET /transaction-position?signature=`

Look up the position context for a single transaction signature — useful when the bounty board is given a tx hash and needs to verify it.

**Required:** `signature`.

**Request:**

```bash
curl 'https://datapi.adrena.trade/transaction-position?signature=3c6euJFA8jXitBFKxU8G6zx4GSRG5215f41uXLgCoa41DRm2irSj55wTcPoq2KqiThWj1PjGwLLnR7nxhVmUPVx5'
```

**Response:**

```json
{
  "success": true,
  "data": {
    "position_id": 108432,
    "method": "openPositionLong",
    "transaction_date": "2026-02-23T20:12:47Z",
    "slot": 402258127,
    "side": "long",
    "user_wallet": "4C9smecZcqEvALzmmgWsDd9w3JHPdVZAEUW86V3oayPx"
  }
}
```

`method` values include: `openPositionLong`, `openPositionShort`, `increasePositionLong`, `increasePositionShort`, `addCollateralLong`, `addCollateralShort`, `removeCollateralLong`, `removeCollateralShort`, `closePositionLong`, `closePositionShort`, `liquidateLong`, `liquidateShort`.

### `GET /position-activity`

Per-position event timeline. Every modifying event the position saw — open, increase, decrease, collateral changes, close, liquidate, SL/TP fires.

**Required:** `position_id`.

**Request:**

```bash
curl 'https://datapi.adrena.trade/position-activity?position_id=108432'
```

**Response:**

```json
{
  "success": true,
  "data": {
    "events": [
      {
        "method": "openPositionLong",
        "transaction_date": "2026-02-23T20:12:47Z",
        "signature": "3c6euJFA8jXit...",
        "slot": 402258127,
        "size_delta_usd": 99.26,
        "collateral_delta_usd": 9.93,
        "price": 98.84,
        "fees_paid_usd": 0.5
      }
    ]
  }
}
```

Use this when a bounty asks "did the trader add collateral", "did they take partial profit", or "how long did they hold before adding more size" — single-position granularity below what `/v4/position` summarizes.

---

# Trader aggregates

### `GET /trader-info`

Per-trader profile — totals across the trader's whole history.

**Required:** `user_wallet`.

**Request:**

```bash
curl 'https://datapi.adrena.trade/trader-info?user_wallet=YOUR_WALLET'
```

**Response:**

```json
{
  "success": true,
  "data": {
    "user_wallet": "YOUR_WALLET",
    "nickname": "trader-name",
    "total_volume": 1240000,
    "total_pnl": -2400,
    "total_fees": 1280,
    "open_positions": 2,
    "closed_positions": 41,
    "liquidated_positions": 3,
    "win_rate": 0.42
  }
}
```

### `GET /trader-profiles`

Bulk profile lookup.

**Optional:** `wallets[]` (repeat for each wallet).

**Request:**

```bash
curl 'https://datapi.adrena.trade/trader-profiles?wallets=W1&wallets=W2'
```

**Response:**

```json
{
  "success": true,
  "data": [
    { "user_wallet": "W1", "nickname": "...", "total_volume": 100000 },
    { "user_wallet": "W2", "nickname": "...", "total_volume": 240000 }
  ]
}
```

### `GET /trader-volume`

Per-trader USD volume + trade count over a date range. Best endpoint for "trade $X volume between dates" bounties.

**Required:** `start_date`, `end_date`.

**Request:**

```bash
curl 'https://datapi.adrena.trade/trader-volume?start_date=2026-04-01&end_date=2026-04-30'
```

**Response:**

```json
{
  "success": true,
  "data": [
    { "user_wallet": "...", "volume_usd": 12000.5, "trades_count": 12 }
  ]
}
```

Returns one row per wallet that had any volume in the range. Filter to your bounty's participating wallets client-side, or pass them through `/trader-profiles` first to seed the list.

---

# Bounty verification recipes

Quick lookup table — given a bounty type, which endpoint(s) to call.

### "Trade ≥ $X notional volume between dates A and B"

```
GET /trader-volume?start_date=A&end_date=B
```

Filter the response to your participant wallet(s); compare `volume_usd >= X`.

### "Open a long position with ≥ 5× leverage on SOL"

```
GET /v4/position?user_wallet=W&status=open&status=close&status=liquidate&side=long&limit=200
```

Filter response client-side: `symbol === "SOL" && entry_leverage >= 5`.

If you only care about *currently open*, drop `status=close&status=liquidate`.

### "Hold a position for at least 24 hours"

```
GET /v4/position?user_wallet=W&status=close&status=liquidate&limit=200
```

Filter: `duration >= 86400` (seconds). For *still-open* holds, compute `Date.now() - entry_date` client-side from `status=open` rows.

### "Close N profitable trades"

```
GET /v4/position?user_wallet=W&status=close&limit=200&sortField=exit_date&sort=DESC
```

Count rows where `pnl > 0`. (Liquidations always have negative PnL — `status=close` filters them out.)

### "Achieve cumulative realized PnL ≥ $X"

```
GET /trader-info?user_wallet=W
```

Read `total_pnl` directly. (For a *date-bounded* PnL, walk `/v4/position` and sum `pnl` where `exit_date` falls in the range.)

### "Verify a specific submitted transaction signature"

```
GET /transaction-position?signature=SIG
```

Confirm `user_wallet`, `method`, `side`, and `transaction_date` match what the bounty requires.

### "Trader added collateral to an existing position"

```
GET /position-activity?position_id=ID
```

Look for events with `method` in `addCollateralLong` / `addCollateralShort`. (You'll need `position_id` first — get it from `/v4/position?user_wallet=W` matching by `pubkey`.)

---

# Notes

- **Indexing lag.** Positions and trades are indexed from on-chain events; expect a few seconds of lag between the tx landing on Solana and the row appearing here. Don't fail a bounty on a tx that just confirmed — retry after ~10 s.
- **Versioning.** `/v2/position`, `/v3/position`, and the bare `/position` endpoints exist for legacy callers; new integrations should use `/v4/position` exclusively.
- **`null` PnL.** `pnl` is `null` while `status = open`. It's populated on full close / liquidate. Partial decreases populate `decrease_pnl`.
- **Liquidations are losses.** A `status = liquidate` row always has negative `pnl`; the trader lost (most or all of) their collateral.
- **Symbol normalization.** Trade math treats `BTC` as `WBTC` and prices `JITOSOL` via `SOLUSD`. The position row reports the symbol the trader actually traded (e.g. `JITOSOL`), not the price-feed symbol.

# Bounty Hunters — Design System

Visual spec for Bounty Hunters UI, derived from live extraction of `adrena.trade` design tokens. Every color, font, gradient, and pattern in this document was lifted from the deployed Adrena app via DevTools — nothing here is invented or aspirational.

## How to use this doc

- Tailwind tokens are in [`tailwind.config.ts`](../tailwind.config.ts). This doc explains *when* to use them and what they mean — the config is the source of truth for *values*, this doc is the source of truth for *intent*.
- For new components, find the closest pattern in [Component patterns](#component-patterns) — don't invent new patterns. If nothing fits, raise it in [Open questions](#open-questions) before reaching for one-off styles.
- [What NOT to do](#what-not-to-do) is non-negotiable.

## Brand context

### What's shipped vs roadmap

The currently deployed Adrena navigation is `Trade / Stake / Provide Liquidity / More`. Figma decks show roadmap features — Ranked, Monitor, boss fights, factions, Mutagens — that are not live in production. Bounty Hunters may be the first competition surface to actually ship, so the visual language must match what's deployed at `adrena.trade` today, not what's painted in Figma for v2.

### Two visual modes

Adrena ships two distinct visual modes:

- **Marketing mode** — heavy creature/monster art, scripted display fonts, magenta/pink accents, parallax. Used on the landing site and lore-heavy pages.
- **Product mode** — dark layered surfaces, monospace numbers, gradient CTAs, no creature art, dense typography-led layouts. Used in the trading app itself.

Bounty Hunters lives in **product mode**. Period. If a pattern only exists in marketing mode, it does not apply here.

## Color tokens

### Surface elevation scale

Adrena does not use `box-shadow` for elevation. It uses background-tone steps. Treat this as a ladder — every elevated surface picks the next rung up. Do not interpolate between rungs.

```
dark         #080a0d   deepest — rarely used, e.g. modal backdrop
main         #060d16   page background
secondary    #061018   slightly elevated — large containers, page sections
third        #151e29   more elevated — read-only fields, inactive surfaces
gray-200     #1a2431   card-on-card — nested panels
inputcolor   #1e2c3c   most elevated functional element — writable inputs
```

When a "card on card" effect is needed, step up one rung. When elevation needs to be more obvious than one rung, that is a sign the layout is wrong — re-flow before reaching for a shadow.

### Semantic colors

```
redbright    #ff344e   hover/active red, highlights
red-500      #c9243a   destructive, negative deltas, validation errors
green-500    #07956b   positive deltas, success markers (NOT CTAs)
blue-500     #3b82f6   info, links, neutral emphasis (NOT CTAs)
orange-500   #f0892b   warning
```

Note: `green-500` and `blue-500` are for inline semantic use (a positive number, an info badge). **Primary CTAs do not use flat semantic colors** — they use the gradient signatures in [CTA gradient signatures](#cta-gradient-signatures).

### Text colors

```
light        #f5f5f5   primary text
txtfade      #858789   secondary/muted text, placeholders, inactive labels
```

There is no third text tier. If text needs to feel even more demoted than `txtfade`, drop the opacity on the parent (e.g. `opacity-60`) rather than picking a third grey.

### Border colors

```
bcolor       #15202c   solid border for dense surfaces
border-white/20        alpha border for inputs and floating elements
```

The alpha border (`border border-white/20`) is the dominant pattern in `adrena.trade` for writable inputs and elevated controls. The solid `bcolor` is used on lower-elevation containers where a hex border reads cleaner.

### No pink

Pink in `adrena.trade` is a wallpaper image at 0.5 opacity (`<div class="fixed ... bg-[url('/images/wallpaper.jpg')] opacity-50">`), not a UI color. Don't use it on UI elements — not as a tier accent, not as a badge color, not as a glow.

## CTA gradient signatures

This is the brand-defining pattern. Both gradients share a chassis: `h-[2.5em] px-6 py-2 text-sm rounded-md font-mono text-white shadow-md hover:shadow-lg transition duration-300`, full width inside their container, hover state is opacity-only.

### Green CTA — commit/execute actions

Use for `[C]laim`, `[S]take`, `[B]uy`, `[O]pen position`, `[V]erify` — anything that commits a transaction or finalizes user intent.

```html
class="bg-gradient-to-r from-emerald-500 via-green-500 to-teal-500 hover:opacity-90 transition duration-300 font-mono text-white rounded-md"
```

Uses stock Tailwind palette names. Stays mid-bright across the gradient. Hover via `opacity-90` only — never swap to a second gradient.

### Blue CTA — navigate / secondary execute

Use for `[T]rade now`, `[H]unt`, navigation actions, and secondary executes that step the user somewhere rather than committing.

```html
class="bg-gradient-to-r from-[#0284c7] via-[#1e40af] to-[#1a2a6a] hover:opacity-90 transition duration-300 font-mono text-white rounded-md"
```

Uses arbitrary hex values (not Tailwind palette names — these are intentionally outside the palette to give the blue a custom dark falloff). Goes light-to-dark dramatically. Same `hover:opacity-90` pattern.

## Typography

`Inter` for body and UI, `Roboto Mono` for everything numeric. Both load via `next/font/google` in [`src/app/layout.tsx`](../src/app/layout.tsx) and bind to CSS variables (`--font-inter`, `--font-roboto-mono`) which Tailwind exposes as `font-sans` and `font-mono`.

Roboto Mono is used liberally — not just code. Use it for:

- All numbers in tables, stats blocks, and balances
- Wallet addresses and transaction hashes
- Button text on CTAs (yes, the buttons themselves are mono)
- Percentages, durations, countdown timers
- Quick-fill chips (`10% / 25% / 50% / 75%`)

Section labels are plain `<h5>` with white text and margin — no uppercase, no muted treatment, no letter-spacing:

```html
<h5 class="text-white mt-2 mb-1">Collateral</h5>
```

## Brand signature: bracket-prefix CTAs

Adrena prefixes primary CTAs with a bracketed first letter: `[S]take`, `[B]uy`, `[P] Open position`, `[T]rade now`. Bounty Hunters inherits this convention: `[C]laim`, `[H]unt`, `[V]erify`.

This is mandatory for primary CTAs. It is the single most recognizable Adrena signature after the gradient itself.

## Numbers formatting

- Right-align in tables and stats blocks.
- Always monospace (`font-mono`).
- Always include the unit (`12.34 SOL`, not `12.34`).
- Positive deltas: `green-500`. Negative deltas: `red-500`. Neutral: `txtfade`.
- Format thousands with commas: `$1,234.56`, never `$1234.56`.
- Two decimals for USD, instrument-appropriate decimals for crypto (4 for SOL, 0–2 for stable, 6+ for fractional positions).

## Spacing & sizing

- Tailwind 4px scale. Don't reach for arbitrary spacing values unless matching a verified Adrena pattern.
- `p-6` for card interior padding.
- `gap-8` for major section gaps; `gap-4` for grid items; `gap-2` for inline element groups.
- Border radius: `rounded-lg` (8px) for cards, `rounded-md` (6px) for buttons and inputs, `rounded-full` for badges, pills, and circular icon buttons.

## Component patterns

Each pattern is paired with the verified HTML structure (or a pointer to where it lives in `adrena.trade`).

### Button — green gradient CTA (execute)

```html
<button class="w-full h-[2.5em] px-6 py-2 text-sm rounded-md font-mono text-white shadow-md hover:shadow-lg transition duration-300 bg-gradient-to-r from-emerald-500 via-green-500 to-teal-500 hover:opacity-90">
  [C]laim bounty
</button>
```

### Button — blue gradient CTA (navigate)

```html
<button class="w-full h-[2.5em] px-6 py-2 text-sm rounded-md font-mono text-white shadow-md hover:shadow-lg transition duration-300 bg-gradient-to-r from-[#0284c7] via-[#1e40af] to-[#1a2a6a] hover:opacity-90">
  [T]rade now
</button>
```

### Button — segmented (Long / Short / Swap)

Inline tabs with an underline indicator beneath the active option. No pill background, no border. Inactive options use `text-txtfade`; the active option uses `text-white` with a 2px white underline. Hovering an inactive option fades it toward white.

### Button — secondary outline

Transparent background, 1px white border (`border border-white/20`), `text-light`, same height/padding as the gradient CTAs but no gradient or shadow. Used for "Cancel" and dismiss actions.

### Card

```html
<div class="bg-secondary border border-bcolor rounded-lg p-6"> ... </div>
```

For a nested card-on-card, swap `bg-secondary` for `bg-gray-200`. No drop shadow — elevation comes from the tone step.

### Stats block (4-up)

A four-column grid. Each cell: small uppercase label in `txtfade text-xs`, large number in `font-mono text-2xl text-light` directly underneath. No icons inside stat cells. No card background — stats sit directly on the surrounding surface, separated only by `gap-8` or 1px vertical dividers.

### Form input (writable)

```html
<div class="bg-inputcolor border border-white/20 h-14 rounded-md px-4 flex items-center">
  <input class="font-mono text-lg bg-transparent placeholder-txtfade flex-1 outline-none" style="font-size: 1.4em" />
  <span class="text-txtfade text-sm">≈ $12.34</span>
</div>
```

The 1.4em override on the primary value is intentional — Adrena makes the editable number visibly larger than surrounding chrome. Secondary line (USD equivalent, conversion rate) uses `text-txtfade text-sm` directly underneath or inline-right.

### Read-only field

```html
<div class="bg-third opacity-60 cursor-not-allowed rounded-md px-4 h-14 flex items-center"
     style="background-size: 10px 10px">
  <span class="font-mono text-lg">0.00</span>
</div>
```

The 10px×10px `background-size` produces a subtle striped/dotted overlay — this is the "this is read-only" visual signal. Preserve it.

### Quick-fill chips (10% / 25% / 50% / 75%)

```html
<button class="px-1.5 py-0.5 hover:text-white text-txtfade font-mono text-xs cursor-pointer">25%</button>
```

No background, no border, no pill styling. Plain text buttons. They flip from `txtfade` to `white` on hover.

### Section label

```html
<h5 class="text-white mt-2 mb-1">Collateral</h5>
```

That's it. No `uppercase`, no `tracking-wider`, no muted-grey treatment.

### Disabled CTA

```html
class="bg-gradient-to-r from-emerald-500 via-green-500 to-teal-500 cursor-not-allowed pointer-events-none opacity-50"
```

Keep the gradient classes — `opacity-50` wins visually. Never swap to a flat grey "disabled" state; the muted gradient is the disabled state.

### Utility icon button

```html
<button class="w-6 h-6 p-1 rounded-full opacity-50 hover:opacity-100 transition duration-300 border-0">
  <RefreshIcon />
</button>
```

Circular, opacity-based hover, no border, no background fill.

### Wallet balance / inline value

```html
<div class="flex items-center gap-1">
  <img class="opacity-60 w-3 h-3" />
  <span class="text-txtfade font-mono text-xs hover:text-white transition-colors">5.5599</span>
</div>
```

Tiny icon + monospace muted number that promotes to white on hover.

### Token selector

```html
<div class="flex items-center gap-2 cursor-pointer">
  <ChevronDown class="w-2 h-2" />
  <div class="text-base">USDC</div>
  <img class="h-4 w-4 rounded-full" src="..." />
</div>
```

Chevron LEFT of the text, token icon RIGHT. Icon is a 16px rounded circle. Do not invert this ordering.

### Validation banner

Inline, directly above the CTA. Red icon (`text-red-500`) + red text (`text-red-500 text-sm`), no background fill. The CTA itself is responsible for disabled state — the banner just explains why.

### Modal / dialog

Pattern open — see [Open questions](#open-questions) #4. Find a verified example in `adrena.trade` before building modals.

### Table

No outer border. 1px row dividers via `border-b border-bcolor` on each row. Right-aligned monospace numbers. Hover row background uses `hover:bg-third`. Headers in `text-txtfade text-xs` (not uppercase).

### Badge / pill

```html
<span class="rounded-full text-xs px-2 py-0.5 bg-green-500/20 text-green-500">Active</span>
```

Always `rounded-full`, always `text-xs`. Background is the semantic color at `/20` alpha, text is the semantic color at full strength.

### Countdown timer

Three columns (`HH / MM / SS`). Each column: large monospace number on top, tiny `txtfade` label below (`hours`, `mins`, `secs`). Numbers are `font-mono text-2xl text-light`. Columns separated by `gap-4`, no colons between them.

## Layout patterns

### App shell

Current production nav: `Trade / Stake / Provide Liquidity / More`. Bounty Hunters lives under one of these as a sub-route (decision in Open questions #1: Option 1 confirmed — Bounty Hunters becomes a new top-nav item, with the trade-page widget treatment deferred to v1.5+).

### Page hero — Bounty Hunters style

Title (`text-3xl font-semibold text-light`) + tagline (`text-txtfade text-base`) on the left; 4-up stats block on the right or below. No themed creature art. No background art. No animated elements. Just typography on the page background.

### Bounty board grid

```html
<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"> ... </div>
```

### Recent claims sidebar

Fixed 320px right rail on desktop. Hidden on mobile (collapses into a separate tab or sheet). Content scrolls independently of the main column.

## Bounty card spec

The single most important component. Structure:

1. **Top row** — tier badge (left) + countdown timer (right). Both use the badge/pill pattern; tier badge uses the tier accent, countdown uses `bcolor`.
2. **Title** — `text-lg font-semibold text-light`.
3. **Description** — `text-sm text-txtfade`, max 2 lines, truncate with ellipsis.
4. **Detail rows** — label/value pairs. Label `text-txtfade text-xs`, value `font-mono text-sm text-light`. Right-align the value.
5. **CTA** — full-width green-gradient button with bracket prefix (`[C]laim bounty`). Sits at the bottom of the card with `mt-auto` so cards in the same row have aligned CTAs even with varying description lengths.

### States

- **Active** — default rendering, CTA enabled.
- **User-eligible** — subtle 1px `redbright` outer ring on the card to flag attention; CTA still green-gradient.
- **Claimed** — CTA replaced with a `bg-green-500/20 text-green-500` "Claimed" badge filling the CTA slot.
- **Expired** — entire card at `opacity-60`, CTA replaced with `bg-third text-txtfade` "Expired" badge.
- **Loading** — skeleton placeholder using the `animate-shimmer` keyframe already defined in [`globals.css`](../src/app/globals.css).

## Tier accents

```
Common       text-gray-400  +  bg-gray-400/20
Rare         text-blue-500  +  bg-blue-500/20
Legendary    text-orange-500 + bg-orange-500/20
```

No pink anywhere. No purple. If a fourth tier is added later, raise it as an open question — don't pick a colour ad-hoc.

## What NOT to do

- ❌ Pink/magenta as a UI color — it's wallpaper, not a token.
- ❌ Flat green or flat blue for primary CTAs — always use the gradient pattern.
- ❌ `shadow-lg` or `shadow-md` for surface elevation — use background-tone steps. Shadows are only for CTA buttons.
- ❌ Themed creature/monster art — marketing-mode only.
- ❌ Custom display fonts beyond Inter + Roboto Mono.
- ❌ Cards nested more than 2 levels deep.
- ❌ Primary CTAs without the `[X]` bracket prefix.
- ❌ Light mode or color-scheme toggle — dark-only.
- ❌ Toast notifications for claim events — use the recent-claims feed.
- ❌ Animated background elements (parallax, particles, gradient sweeps).
- ❌ Icons inside stats blocks — pure typography.

## Reference screenshots

There are ~69 screenshots in `/mnt/project/` from the extraction session. Notable ones to consult when implementing patterns:

- Trade form (input field, quick-fill chips, token selector, validation banner) — search for screenshots tagged "trade-form".
- Position card (read-only field, striped pattern, disabled CTA) — search for "position-card".
- Stake page (segmented buttons, stats block) — search for "stake".
- Wallet balance row (inline value pattern) — search for "wallet-balance".

Browse the full set when a pattern in this doc feels underspecified.

## Open questions

- ✅ #1 Nav placement — Option 1 (new top-nav item) confirmed by ZeDef on 2026-05-09. Option 3 (trade-page widget) deferred to v1.5+.
- ✅ #2 Exact hex values — extracted from `adrena.trade`.
- ✅ #3 Font family — Inter + Roboto Mono.
- #4 Modal pattern — open. Find a verified example in `/mnt/project/` and document the structure (backdrop colour, container surface, header/footer layout, close affordance) before building any modal.
- #5 Loading state — open. Skeleton (per the existing `animate-shimmer` keyframe) vs. spinner? Default assumption: skeleton for content regions, no spinners.
- #6 Empty state — open. Likely typographic only (no themed art in product mode). Confirm with a verified Adrena empty state before designing.
- #7 Wallpaper layer — if Bounty Hunters is embedded inside `adrena.trade`, the wallpaper at `opacity-50` is inherited automatically. If standalone, decide whether to replicate the wallpaper, use a flat `bg-main`, or render a different ambient texture.
- #8 Route name — `/bounties` is the working assumption. Can rename later without disturbing the design system.

## Changelog

- **v0.4** (this commit) — initial `DESIGN.md` created from verified `adrena.trade` extraction. All tokens, fonts, and verified UI patterns documented. Tailwind config and `next/font` wiring landed in the same commit.

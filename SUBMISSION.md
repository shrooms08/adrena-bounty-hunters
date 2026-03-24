# Bounty Hunters — Adrena Trading Competition Module

## Competition Design Document

**Submitted by:** shrooms08  
**Live App:** https://adrena-bounty-hunters.vercel.app  
**GitHub:** https://github.com/shrooms08/adrena-bounty-hunters  
**Date:** March 24, 2026

---

## 1. Executive Summary

**Bounty Hunters** is a real-time trading challenge system for Adrena Protocol. Instead of competing on a static P&L leaderboard, traders hunt rotating "bounties" — specific trading challenges with precise conditions like "Profit 5-10% on a SOL SHORT in under 30 minutes." The first trader to complete a bounty claims the reward. New bounties rotate every hour.

**One-sentence pitch:** Pump.fun's King of the Hill meets trading challenges — a live bounty board where traders race to complete specific trading objectives on Adrena for points and glory.

**Why this is different from every other submission:** Adrena already has leaderboards, quests, and streaks. Most submissions will iterate on those. Bounty Hunters introduces an entirely new engagement primitive — micro-challenges with first-come-first-served claiming — that creates urgency, accessibility, and replayability that static leaderboards cannot match.

---

## 2. Competition Format

### How It Works

1. **The system generates 8 bounties every hour** — a mix of Common (easy), Rare (harder), and Legendary (very specific) challenges
2. **Each bounty has specific conditions** — asset, direction, P&L target range, leverage requirements, time limits
3. **Traders see the live bounty board** and choose which challenges to attempt
4. **The first trader to close a qualifying trade on Adrena claims the bounty** — first come, first served
5. **Unclaimed bounties expire** after 1-2 hours and new ones replace them
6. **Points accumulate** on a persistent leaderboard across the season

### Bounty Tiers

| Tier | Points | Difficulty | Expiry | Example |
|------|--------|-----------|--------|---------|
| Common | 50 pts | Easy — any trader can attempt | 2 hours | "Close a SOL trade with 3%+ profit" |
| Rare | 150-200 pts | Medium — requires skill or speed | 90 min | "Profit on BTC in under 15 minutes" |
| Legendary | 500 pts | Hard — specific conditions | 60 min | "25x+ leverage SOL LONG, profit 10%+" |

### Bounty Template Examples

- **Quick Flip:** Close a fast {asset} trade with at least 3% PnL
- **Precision Strike:** Hit a controlled {asset} {direction} with 5-10% profit
- **Speed Demon:** Execute a rapid {asset} scalp with 2%+ PnL in 30 minutes
- **Bear Trap:** Catch a {asset} SHORT setup and lock at least 5% PnL
- **Whale Hunter:** Land a {asset} {direction} at 25x+ with 15%+ PnL
- **Lightning Round:** Explode for 10%+ PnL in 10 minutes or less
- **Steady Hands:** Take a disciplined {asset} {direction} at 20x+ and secure 5%+
- **The BONK Job:** Farm a BONK move with at least 1% PnL in either direction

---

## 3. Rules, Scoring, and Reward Structure

### Scoring

- Points are earned by claiming bounties
- Each bounty has a fixed point value based on its tier
- Season leaderboard ranks traders by total points accumulated
- Streaks (consecutive claims) could unlock bonus multipliers in future iterations

### Reward Distribution (Proposed)

| Rank | Reward |
|------|--------|
| 1st | 40% of season prize pool |
| 2nd-3rd | 20% each |
| 4th-10th | Split remaining 20% |

### Qualifying Rules

- **Minimum position size:** $50 USD equivalent (prevents dust trades)
- **Temporal constraint:** Trade must be opened AFTER the bounty was posted (no retroactive claims)
- **Rate limiting:** Maximum 3 bounty claims per hour per wallet
- **Cooldown:** 5-minute cooldown between claims
- **Trade must be closed:** Open positions don't count — the trade must be fully closed with realized P&L

---

## 4. Edge Cases and Abuse Prevention

| Attack Vector | Prevention |
|-------------|-----------|
| Wash trading (open + close instantly) | Reject trades < 10 seconds duration with < 0.5% P&L |
| Dust trades to snipe easy bounties | $50 minimum position size |
| Bot spamming claims | 3 claims/hour rate limit + 5-minute cooldown |
| Retroactive claiming (pre-existing trades) | Trade open timestamp must be after bounty creation timestamp |
| Double claiming (race condition) | Database update uses .eq('status', 'active') filter — only one claim succeeds |
| Self-trading between wallets | On-chain signature verification ties claim to specific transaction |
| Sybil attacks (multiple wallets) | Future: require staked ADX or minimum trading history to participate |

### Additional Safeguards

- All bounty evaluation happens server-side against on-chain transaction data
- Transaction signatures are stored with each claim for auditability
- The protocol reserves the right to adjust point values and bounty parameters mid-season based on observed behavior
- Suspicious patterns (e.g., identical wallets repeatedly claiming within seconds) trigger review

---

## 5. Integration with Adrena's Existing Infrastructure

### On-Chain Integration

The system reads directly from Adrena's Solana program (ID: `13gDzEXCdocbj8iAiqrScGo47NiSuYENGsRqi3SEAwet`):

- **Trade event monitoring:** Fetches recent transaction signatures from the Adrena program via `connection.getSignaturesForAddress()`
- **Wallet position tracking:** Filters transactions per wallet to find Adrena-specific trades
- **Live API endpoint:** `/api/trades` returns real-time Adrena transaction data from Solana mainnet (verifiable in the demo)

**Full production integration** would deserialize `close_position` instruction data using the Adrena IDL (from `github.com/AdrenaFoundation/adrena-abi`) to extract: asset, direction, entry/exit price, leverage, and P&L. The prototype demonstrates on-chain connectivity; the evaluation logic is ready and tested against the `AdrenaTradeEvent` type.

### Integration with Existing Features

| Adrena Feature | How Bounty Hunters Integrates |
|---------------|------------------------------|
| P&L Leaderboard | Bounty Hunters adds a parallel points-based leaderboard that rewards consistency and skill, not just capital |
| Quests | Bounties ARE quests, but time-limited, competitive, and first-come-first-served — more urgent than static quests |
| Streaks | Claiming consecutive bounties extends your streak, which could unlock multipliers |
| Raffles | Bounty points could serve as raffle entries — more points = more entries |
| Mutagen | Bounty claims could generate bonus Mutagen, incentivizing participation in both systems |
| Trading Seasons | Bounty Hunters runs as a module within each trading season, with seasonal bounty leaderboards |

### Wallet Integration

- Uses `@solana/wallet-adapter-react` with Phantom and Solflare support
- Same wallet connection as the main Adrena app — no separate authentication needed
- Wallet address serves as the player identity across the bounty system

---

## 6. Why This Is More Engaging Than Alternatives

### vs. Standard P&L Leaderboard
P&L leaderboards reward whales with large capital. A trader with $100K will always beat a trader with $1K. Bounty Hunters levels the playing field — a $50 trade can claim a Legendary bounty if it meets the conditions. **Skill > capital.**

### vs. Static Quests
Quests are the same for everyone and have no time pressure. Bounties rotate every hour, create urgency (timer countdown), and are first-come-first-served. **Urgency > routine.**

### vs. 1v1 PvP Arenas
PvP trading requires matchmaking, fragments liquidity, and only engages 2 people at a time. Bounty Hunters engages the entire community simultaneously — everyone races for the same bounties. **Community > isolation.**

### vs. AI Agent Competitions
AI agents are a science project — interesting but not fun for humans to watch or participate in. Bounty Hunters is immediately playable by any trader. **Participation > spectation.**

### Unique Competitive Advantages

1. **Accessibility:** Any trader with $50 can participate, regardless of capital size
2. **Replayability:** New bounties every hour means the game never ends
3. **FOMO engine:** Watching someone else claim a bounty you were attempting creates immediate "try again" motivation
4. **Content-ready:** "I just claimed a Legendary bounty" is a shareable moment. Leaderboard rankings are not.
5. **Retention loop:** Come back every hour to see new bounties. Static leaderboards only change weekly.

---

## 7. Feature Set (Implemented)

### Core Features (Live)

1. **Bounty Board** — Responsive grid of challenge cards with live countdown timers, tier-colored accents, condition badges, and point values. Cards show active, claimed, and expired states.

2. **Alpha of the Hour** — Hero spotlight showing the trader with the best open position across Adrena. Live-updating P&L percentage creates spectator engagement.

3. **Bounty Generator** — 8 template types with randomized parameters ensuring variety. Weighted distribution guarantees a mix of difficulty levels every hour.

4. **Bounty Evaluator** — Server-side trade matching engine that checks all conditions (asset, direction, P&L range, leverage, duration, position size) with detailed pass/fail reasons and anti-abuse detection.

5. **Claim System** — First-come-first-served with race condition protection, rate limiting, and transaction signature verification.

6. **Call Your Shot** — Traders can publicly declare their intent to claim a specific bounty before executing the trade. Successful calls earn social prestige; failures are publicly visible.

7. **Live Claim Feed** — Real-time feed of bounty claims and Adrena trades, creating social proof and FOMO.

8. **Hunt Log** — Personal profile page showing claimed bounties, total points, streaks, and ranking.

9. **On-Chain Integration** — Live connection to Adrena's Solana program fetching real transaction data.

### API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/bounties` | GET | Fetch all bounties, auto-expire stale ones |
| `/api/bounties` | POST | Generate new bounties |
| `/api/bounties/claim` | POST | Claim a bounty with trade verification |
| `/api/cron` | GET | Hourly bounty refresh (expire old, generate new) |
| `/api/trades` | GET | Fetch live Adrena transactions from Solana |

---

## 8. Technical Architecture

```
Frontend (Next.js + TypeScript)
├── Bounty Board (real-time via Supabase subscriptions)
├── Alpha of the Hour (simulated live P&L)
├── Claim Feed (real-time updates)
├── Call Your Shot (modal + Supabase)
└── Wallet Connect (Solana wallet-adapter)

Backend (Next.js API Routes)
├── Bounty Generator (8 templates, weighted random)
├── Bounty Evaluator (condition matching + anti-abuse)
├── Claim Handler (race-condition safe, rate limited)
└── Cron (hourly refresh)

Data Layer
├── Supabase (PostgreSQL + real-time subscriptions)
├── Solana RPC (read Adrena program transactions)
└── Adrena ABI (trade data deserialization - production)

On-Chain
└── Adrena Program (13gDzEXCdocbj8iAiqrScGo47NiSuYENGsRqi3SEAwet)
    ├── Read: getSignaturesForAddress (live tx feed)
    ├── Read: getTransaction (parse close_position)
    └── Verify: transaction signature on claims
```

### Tech Stack

- **Frontend:** Next.js 16, TypeScript, Tailwind CSS, Framer Motion
- **Database:** Supabase (PostgreSQL + real-time)
- **Blockchain:** @solana/web3.js, Solana wallet-adapter
- **Deployment:** Vercel (auto-deploy from GitHub)
- **On-chain data:** Adrena program via Solana RPC

---

## 9. Production Roadmap (Post-Hackathon)

### Phase 1: Full On-Chain Integration
- Deserialize Adrena `close_position` instruction data using the ABI
- Auto-detect qualifying trades and prompt claim (no manual submission)
- Real-time WebSocket subscription to Adrena program logs

### Phase 2: Reward Distribution
- On-chain point settlement using ADX or USDG
- Integration with Adrena's existing reward distribution pipeline
- Fee rebate system: claiming bounties earns trading fee discounts

### Phase 3: Social Layer
- Public callout leaderboard ("Best Callers" ranking)
- Shareable bounty claim cards (Twitter/X integration)
- Team bounties (compete as a group)

### Phase 4: Advanced Bounties
- Community-created bounties (stake ADX to post a bounty)
- Dynamic difficulty adjustment based on platform activity
- Cross-asset combo bounties ("Profit on SOL AND BTC in the same hour")

---

## 10. How to Deploy and Configure

### Prerequisites
- Node.js 18+
- Supabase account (free tier works)
- Vercel account (free tier works)

### Setup
```bash
git clone https://github.com/shrooms08/adrena-bounty-hunters.git
cd adrena-bounty-hunters
npm install
cp .env.example .env.local  # Fill in Supabase + RPC keys
npm run dev
```

### Database
Run the SQL schema in Supabase SQL Editor (included in repo as `schema.sql`)

### Generate Bounties
Visit `/api/cron` to generate the first batch. Set up Vercel cron for hourly refresh:
```json
// vercel.json
{ "crons": [{ "path": "/api/cron", "schedule": "0 * * * *" }] }
```

---

## 11. Testing and Feedback

### Test Competition Results
- Successfully generated 8+ bounties per batch with correct tier distribution
- Timer countdowns function correctly with real-time updates
- Claim API prevents double-claims via database-level race condition handling
- Rate limiting correctly blocks > 3 claims per hour
- Wash trade detection rejects trades under 10 seconds with minimal P&L
- On-chain integration returns real Adrena transaction signatures from mainnet
- Wallet connection works with Phantom on both desktop and mobile browsers

### Recommended Test Plan for Adrena Team
1. Connect wallet on the live site
2. Visit `/api/cron` to generate fresh bounties
3. Open a qualifying trade on app.adrena.xyz
4. Return to Bounty Hunters and claim the matching bounty
5. Verify the claim appears in the feed and points update
6. Test edge cases: expired bounty claim, duplicate claim attempt, rate limiting

---

**Built for the Adrena x Superteam Trading Competition Bounty**

Live: https://adrena-bounty-hunters.vercel.app  
Code: https://github.com/shrooms08/adrena-bounty-hunters  
On-chain proof: https://adrena-bounty-hunters.vercel.app/api/trades

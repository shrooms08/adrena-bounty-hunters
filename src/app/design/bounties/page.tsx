import { notFound } from "next/navigation";
import { BountyCard } from "@/components/bounty/BountyCard";
import type { BountyView } from "@/types";

export const metadata = {
  title: "Design / Bounties",
  robots: { index: false, follow: false },
};

// Smoke test only — needs render-time `Date.now()` so the <1-minute
// countdown demo stays live on every page load. Production /bounties
// will not need this.
export const dynamic = "force-dynamic";

// Smoke-only: hardcoded "qualifying" bounties so the [You qualify] pill is
// visible in design-review screenshots. The real production page derives this
// from /api/bounties/eligible. One common + one legendary so reviewers see
// the pill against both muted and bright tier backgrounds.
const QUALIFIES_DEMO = new Set(["b-common-no-hunters", "b-legendary-full"]);

function buildSampleBounties(): BountyView[] {
  const now = Date.now();
  const iso = (offsetMs: number) => new Date(now + offsetMs).toISOString();
  return [
  {
    id: "b-legendary-full",
    tier: "legendary",
    title: "Hit 10% PnL in 60 minutes",
    description:
      "Open a SOL long with at least 5x leverage and close it with 10% or more profit within an hour of opening.",
    asset: "SOL",
    side: "long",
    minLeverage: 5,
    minPnlPercent: 10,
    minCollateralUsd: 500,
    maxDurationMinutes: 60,
    rewardPoints: 2500,
    expiresAt: iso(23 * 60 * 60 * 1000 + 14 * 60 * 1000),
    createdAt: iso(-2 * 60 * 60 * 1000),
    state: "active",
    activeHuntersCount: 4,
  },
  {
    id: "b-rare-minimal",
    tier: "rare",
    title: "First short on BTC",
    description: "Open a BTC short of any size and close it with positive PnL.",
    asset: "BTC",
    side: "short",
    minPnlPercent: 0.1,
    rewardPoints: 500,
    expiresAt: iso(5 * 60 * 60 * 1000 + 12 * 60 * 1000),
    createdAt: iso(-30 * 60 * 1000),
    state: "active",
    activeHuntersCount: 1,
  },
  {
    id: "b-common-no-hunters",
    tier: "common",
    title: "Survive 100x for 5 minutes",
    description:
      "Open any direction on BONK at 100x leverage and hold the position for at least 5 minutes without liquidation.",
    asset: "BONK",
    side: "any",
    minLeverage: 100,
    minCollateralUsd: 50,
    rewardPoints: 100,
    expiresAt: iso(8 * 60 * 60 * 1000),
    createdAt: iso(-15 * 60 * 1000),
    state: "active",
    activeHuntersCount: 0,
  },
  {
    id: "b-urgent",
    tier: "rare",
    title: "Lightning round — any profitable BONK short",
    description:
      "Close any BONK short at a profit before the timer hits zero. Going fast.",
    asset: "BONK",
    side: "any",
    minPnlPercent: 0.1,
    rewardPoints: 250,
    expiresAt: iso(30 * 1000),
    createdAt: iso(-10 * 60 * 1000),
    state: "active",
    activeHuntersCount: 7,
  },
  {
    id: "b-long-runway",
    tier: "common",
    title: "Week-long grind: $1k volume",
    description:
      "Trade at least $1,000 of cumulative SOL volume over the next 28 hours.",
    asset: "SOL",
    side: "any",
    minCollateralUsd: 100,
    rewardPoints: 75,
    expiresAt: iso(28 * 60 * 60 * 1000),
    createdAt: iso(-1 * 60 * 60 * 1000),
    state: "active",
    activeHuntersCount: 2,
  },
  {
    id: "b-claimed",
    tier: "legendary",
    title: "Hit 5% PnL in 24h",
    description:
      "Open a SOL long, close with at least 5% profit within 24 hours of opening.",
    asset: "SOL",
    side: "long",
    minLeverage: 3,
    minPnlPercent: 5,
    minCollateralUsd: 100,
    maxDurationMinutes: 1440,
    rewardPoints: 1000,
    expiresAt: iso(20 * 60 * 60 * 1000),
    createdAt: iso(-6 * 60 * 60 * 1000),
    state: "claimed",
    claimedBy: "8rVFKzKqWePc5tT2sN1mB9YDgHxqL3oa4rJpQXmaPVvh",
    claimedAt: iso(-3 * 60 * 1000),
    activeHuntersCount: 0,
  },
  {
    id: "b-expired",
    tier: "rare",
    title: "Liquidate the morning dip",
    description:
      "Catch the early dip by shorting BTC with positive PnL inside a 4-hour window.",
    asset: "BTC",
    side: "short",
    minPnlPercent: 2,
    rewardPoints: 400,
    expiresAt: iso(-2 * 60 * 60 * 1000),
    createdAt: iso(-12 * 60 * 60 * 1000),
    state: "expired",
    activeHuntersCount: 0,
  },
  ];
}

export default function BountiesDesignPage() {
  if (process.env.NODE_ENV === "production") notFound();

  const sampleBounties = buildSampleBounties();
  const active = sampleBounties.filter((b) => b.state === "active");
  const past = sampleBounties.filter((b) => b.state !== "active");

  return (
    <main className="min-h-screen text-light font-sans p-8">
      <div className="max-w-6xl mx-auto flex flex-col gap-10">
        <header>
          <h1 className="text-2xl font-semibold text-white">
            Bounty cards — v0 visual smoke test
          </h1>
          <p className="text-txtfade text-sm mt-1">
            Dev-only. Static mock bounties — no wallet integration or
            eligibility logic.
          </p>
        </header>

        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-white text-lg font-semibold">
              Active Bounties ({active.length})
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {active.map((b) => (
              <BountyCard
                key={b.id}
                bounty={b}
                qualifies={QUALIFIES_DEMO.has(b.id)}
              />
            ))}
          </div>
        </section>

        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-white text-lg font-semibold">
              Past Bounties ({past.length})
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {past.map((b) => (
              <BountyCard key={b.id} bounty={b} />
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}

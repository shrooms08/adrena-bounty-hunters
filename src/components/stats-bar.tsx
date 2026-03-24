interface StatsBarProps {
  activeCount: number;
  claimedCount: number;
}

const STATS_CONFIG = [
  { key: "active", label: "Active Bounties", color: "#00d4ff" },
  { key: "claimed", label: "Claimed", color: "#34d399" },
  { key: "leverage", label: "Avg Leverage", color: "#f1f5f9" },
  { key: "hunters", label: "Hunters Online", color: "#fbbf24" },
] as const;

export function StatsBar({ activeCount, claimedCount }: StatsBarProps) {
  const values: Record<string, string> = {
    active: String(activeCount),
    claimed: String(claimedCount),
    leverage: "27x",
    hunters: "312",
  };

  return (
    <section
      className="mb-8"
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(4, 1fr)",
        gap: "16px",
      }}
    >
      {STATS_CONFIG.map((stat) => (
        <article
          key={stat.key}
          className="relative overflow-hidden rounded-xl border border-white/[0.06] bg-[#0f0f14] p-4"
        >
          <div
            className="absolute inset-y-0 left-0 w-[3px]"
            style={{ backgroundColor: stat.color }}
          />
          <p className="mb-1 font-mono text-[11px] uppercase tracking-wider text-slate-500">
            {stat.label}
          </p>
          <div className="flex items-center gap-2">
            <p
              className="font-mono text-2xl font-bold"
              style={{ color: stat.color }}
            >
              {values[stat.key]}
            </p>
            {stat.key === "active" && (
              <span
                className="inline-block h-2 w-2 animate-pulse rounded-full"
                style={{ backgroundColor: stat.color }}
              />
            )}
          </div>
        </article>
      ))}
    </section>
  );
}

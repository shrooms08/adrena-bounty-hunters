import { Target, CheckCircle2, TrendingUp } from "lucide-react";

interface StatsBarProps {
  activeCount: number;
  claimedCount: number;
  avgLeverage: number | null;
}

export function StatsBar({
  activeCount,
  claimedCount,
  avgLeverage,
}: StatsBarProps) {
  const stats = [
    {
      label: "Active bounties",
      value: String(activeCount),
      color: "text-emerald-400",
      icon: <Target className="h-5 w-5 text-gray-500" />,
    },
    {
      label: "Claimed",
      value: String(claimedCount),
      color: "text-emerald-400",
      icon: <CheckCircle2 className="h-5 w-5 text-gray-500" />,
    },
    {
      label: "Avg leverage",
      value: avgLeverage === null ? "—" : `${avgLeverage.toFixed(1)}×`,
      color: "text-white",
      icon: <TrendingUp className="h-5 w-5 text-gray-500" />,
    },
  ] as const;

  return (
    <div className="mx-4 mt-4 overflow-hidden rounded-2xl border border-white/[0.06] bg-[#1a1735] lg:mx-0">
      <div className="grid grid-cols-3 divide-x divide-white/[0.06]">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="flex flex-col items-center px-6 py-5 text-center"
          >
            {stat.icon}
            <p className="mt-2 text-[10px] font-medium uppercase tracking-wider text-gray-500">
              {stat.label}
            </p>
            <p
              className={`mt-1 tabular-nums font-heading text-2xl font-bold ${stat.color}`}
            >
              {stat.value}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

import { BountyCard } from "@/components/bounty-card";
import type { BountyRow } from "@/types";

interface BountyBoardProps {
  bounties: BountyRow[];
  onSelectBounty?: (bounty: BountyRow) => void;
}

export function BountyBoard({ bounties, onSelectBounty }: BountyBoardProps) {
  const activeCount = bounties.filter((b) => b.status === "active").length;

  return (
    <section className="mb-10">
      <header className="mb-5 mt-8 flex items-end justify-between gap-4 px-4 lg:mt-10 lg:px-0">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="font-heading text-2xl font-bold text-white">
              BountyRow Board
            </h2>
            {activeCount > 0 && (
              <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-bold tabular-nums text-emerald-400">
                {activeCount} live
              </span>
            )}
          </div>
          <p className="mt-1.5 max-w-lg text-sm text-gray-500">
            Live challenges with countdown timers. Complete the trade on Adrena,
            then claim with your tx signature.
          </p>
        </div>
        <p className="shrink-0 text-right text-[10px] font-medium uppercase tracking-wider text-emerald-400/70">
          First-come first-served
        </p>
      </header>

      <div className="grid grid-cols-1 gap-4 px-4 lg:px-0">
        {bounties.map((bounty) => (
          <BountyCard
            key={bounty.id}
            bounty={bounty}
            onSelectBounty={onSelectBounty}
          />
        ))}
      </div>
    </section>
  );
}

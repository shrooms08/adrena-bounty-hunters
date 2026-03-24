import { BountyCard } from "@/components/bounty-card";
import type { Bounty } from "@/types";

interface BountyBoardProps {
  bounties: Bounty[];
  onSelectBounty?: (bounty: Bounty) => void;
}

export function BountyBoard({ bounties, onSelectBounty }: BountyBoardProps) {
  return (
    <section className="mb-6">
      <div className="mb-5 flex items-end justify-between">
        <div>
          <h2 className="font-heading text-2xl text-[var(--text-primary)]">Bounty Board</h2>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Live challenge cards with countdown pressure.
          </p>
        </div>
        <p className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--accent)]">
          first-come-first-served
        </p>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "16px" }}>
        {bounties.map((bounty) => (
          <BountyCard key={bounty.id} bounty={bounty} onSelect={onSelectBounty} />
        ))}
      </div>
    </section>
  );
}

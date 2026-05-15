"use client";

import { useSyncExternalStore } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { truncateWallet } from "@/lib/constants";

const subscribe = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

export function Navbar() {
  const mounted = useSyncExternalStore(
    subscribe,
    getClientSnapshot,
    getServerSnapshot,
  );

  const { publicKey } = useWallet();
  const walletLabel = publicKey
    ? truncateWallet(publicKey.toBase58())
    : "Connect wallet";

  return (
    <nav className="sticky top-0 z-50 flex h-16 items-center justify-between border-b border-white/[0.06] bg-[#0c0a1d] px-6">
      <div className="flex items-center gap-3">
        <span className="font-heading text-[15px] font-bold tracking-[0.06em] text-white">
          BOUNTY HUNTERS
        </span>
        <span className="rounded-md border border-white/[0.06] bg-[#1a1735] px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-gray-400">
          Beta
        </span>
      </div>

      {mounted ? (
        <WalletMultiButton className="!h-auto !min-h-0 !rounded-xl !border !border-white/[0.06] !bg-[#1a1735] !px-4 !py-2 font-heading !text-[12px] !font-semibold !leading-tight !text-gray-300 !shadow-none transition-colors hover:!border-white/[0.1] hover:!bg-[#211e40]">
          {walletLabel}
        </WalletMultiButton>
      ) : (
        <div
          aria-hidden="true"
          className="h-10 w-[128px] rounded-xl border border-white/[0.06] bg-[#1a1735]"
        />
      )}
    </nav>
  );
}

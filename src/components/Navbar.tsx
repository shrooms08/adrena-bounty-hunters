"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";

export function Navbar() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <nav className="sticky top-0 z-50 border-b border-white/[0.04] bg-[#09090b]/90 backdrop-blur-xl">
      <div className="mx-auto flex h-16 w-full max-w-[1400px] items-center justify-between px-6">
        {/* Left: logo + brand + badge + nav */}
        <div className="flex items-center gap-3">
          <div className="grid h-7 w-7 place-items-center rounded-lg bg-gradient-to-br from-cyan-400 to-violet-500">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="2.5"
              strokeLinecap="round"
              className="h-3.5 w-3.5"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="5" />
              <circle cx="12" cy="12" r="1.5" />
              <path d="M12 3v4M12 17v4M3 12h4M17 12h4" />
            </svg>
          </div>

          <span className="font-mono text-sm font-bold tracking-tight text-white">
            BOUNTY HUNTERS
          </span>

          <span className="rounded-md border border-cyan-400/20 bg-cyan-400/8 px-1.5 py-0.5 font-mono text-[9px] font-bold text-cyan-400">
            BETA
          </span>

          <div className="ml-4 hidden items-center gap-1 md:flex">
            <Link
              href="/bounties"
              className="rounded-lg px-3 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-white/[0.05] hover:text-white"
            >
              Board
            </Link>
            <Link
              href="/profile"
              className="rounded-lg px-3 py-2 text-sm font-medium text-slate-500 transition-colors hover:bg-white/[0.05] hover:text-slate-300"
            >
              Hunt Log
            </Link>
            <a
              href="https://app.adrena.xyz"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium text-slate-500 transition-colors hover:bg-white/[0.05] hover:text-slate-300"
            >
              Trade
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="h-3 w-3"
                aria-hidden="true"
              >
                <path d="M7 17L17 7" />
                <path d="M8 7h9v9" />
              </svg>
            </a>
          </div>
        </div>

        {/* Right: wallet */}
        {mounted ? (
          <WalletMultiButton className="!h-10 !rounded-xl !border !border-white/10 !bg-white/[0.05] !px-4 !py-2 !font-mono !text-sm !font-medium !text-slate-300 !shadow-none hover:!bg-white/10" />
        ) : (
          <button className="h-10 rounded-xl border border-white/10 bg-white/[0.05] px-4 py-2 font-mono text-sm font-medium text-slate-300">
            Connect
          </button>
        )}
      </div>
    </nav>
  );
}

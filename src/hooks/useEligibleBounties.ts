"use client";

import { useEffect, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";

interface EligibilityState {
  wallet: string | null;
  ids: Set<string>;
  loading: boolean;
  error: string | null;
}

const INITIAL_STATE: EligibilityState = {
  wallet: null,
  ids: new Set(),
  loading: false,
  error: null,
};

const EMPTY_IDS: Set<string> = new Set();

export function useEligibleBounties() {
  const { publicKey } = useWallet();
  const walletStr = publicKey?.toBase58() ?? null;
  const [state, setState] = useState<EligibilityState>(INITIAL_STATE);

  useEffect(() => {
    if (!walletStr) return;

    let cancelled = false;

    fetch(`/api/bounties/eligible?wallet=${encodeURIComponent(walletStr)}`)
      .then(async (res) => {
        if (!res.ok) {
          throw new Error(`eligibility check failed: ${res.status}`);
        }
        return res.json() as Promise<{ eligibleBountyIds: string[] }>;
      })
      .then((data) => {
        if (cancelled) return;
        setState({
          wallet: walletStr,
          ids: new Set(data.eligibleBountyIds),
          loading: false,
          error: null,
        });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setState({
          wallet: walletStr,
          ids: EMPTY_IDS,
          loading: false,
          error: err instanceof Error ? err.message : "unknown",
        });
      });

    return () => {
      cancelled = true;
    };
  }, [walletStr]);

  // Derive at render time: if the stored wallet doesn't match the current
  // wallet (just disconnected or switched), return empty. The effect will
  // refetch and update on the next tick.
  const matchesCurrentWallet = state.wallet === walletStr;
  return {
    eligibleBountyIds: matchesCurrentWallet ? state.ids : EMPTY_IDS,
    loading: matchesCurrentWallet ? state.loading : false,
    error: matchesCurrentWallet ? state.error : null,
  };
}

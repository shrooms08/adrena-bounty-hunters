"use client";

import { useCallback, useEffect, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";

export interface ClaimDetails {
  signature: string;
  pnlPercent: number;
  leverage: number;
  durationMinutes: number;
}

interface EligibilityState {
  wallet: string | null;
  ids: Set<string>;
  claimMap: Record<string, ClaimDetails>;
  loading: boolean;
  error: string | null;
}

const INITIAL_STATE: EligibilityState = {
  wallet: null,
  ids: new Set(),
  claimMap: {},
  loading: false,
  error: null,
};

const EMPTY_IDS: Set<string> = new Set();
const EMPTY_MAP: Record<string, ClaimDetails> = {};

export function useEligibleBounties() {
  const { publicKey } = useWallet();
  const walletStr = publicKey?.toBase58() ?? null;
  const [state, setState] = useState<EligibilityState>(INITIAL_STATE);
  const [refetchTick, setRefetchTick] = useState(0);

  useEffect(() => {
    if (!walletStr) return;

    let cancelled = false;

    fetch(`/api/bounties/eligible?wallet=${encodeURIComponent(walletStr)}`)
      .then(async (res) => {
        if (!res.ok) {
          throw new Error(`eligibility check failed: ${res.status}`);
        }
        return res.json() as Promise<{
          eligibleBountyIds: string[];
          claimMap: Record<string, ClaimDetails>;
        }>;
      })
      .then((data) => {
        if (cancelled) return;
        setState({
          wallet: walletStr,
          ids: new Set(data.eligibleBountyIds),
          claimMap: data.claimMap ?? {},
          loading: false,
          error: null,
        });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setState({
          wallet: walletStr,
          ids: EMPTY_IDS,
          claimMap: EMPTY_MAP,
          loading: false,
          error: err instanceof Error ? err.message : "unknown",
        });
      });

    return () => {
      cancelled = true;
    };
  }, [walletStr, refetchTick]);

  const refetch = useCallback(() => setRefetchTick((n) => n + 1), []);

  const matchesCurrentWallet = state.wallet === walletStr;
  return {
    eligibleBountyIds: matchesCurrentWallet ? state.ids : EMPTY_IDS,
    claimMap: matchesCurrentWallet ? state.claimMap : EMPTY_MAP,
    loading: matchesCurrentWallet ? state.loading : false,
    error: matchesCurrentWallet ? state.error : null,
    refetch,
  };
}

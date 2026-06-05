"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import type { Claim } from "@/types";

export function useClaims() {
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchClaims = async () => {
    try {
      const res = await fetch("/api/claims");
      const json: { data?: Claim[]; error?: string } = await res.json();
      if (json.data) setClaims(json.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchClaims();

    const channel = supabase
      .channel("claims-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "claims" },
        () => {
          void fetchClaims();
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);

  return { claims, loading, refetch: fetchClaims };
}

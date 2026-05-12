"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import type { BountyRow } from "@/types";

export function useBounties() {
  const [bounties, setBounties] = useState<BountyRow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchBounties = async () => {
    try {
      const res = await fetch("/api/bounties");
      const json: { data?: BountyRow[]; error?: string } = await res.json();
      if (json.data) setBounties(json.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchBounties();

    const channel = supabase
      .channel("bounties-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "bounties" },
        () => {
          void fetchBounties();
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);

  return { bounties, loading, refetch: fetchBounties };
}

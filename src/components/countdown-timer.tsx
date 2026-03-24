"use client";

import { useEffect, useState } from "react";
import { formatCountdown } from "@/lib/format";

interface CountdownTimerProps {
  targetIso: string;
}

export function CountdownTimer({ targetIso }: CountdownTimerProps) {
  const [formatted, setFormatted] = useState<string>("--:--");

  useEffect(() => {
    const update = () => {
      setFormatted(formatCountdown(targetIso, Date.now()));
    };

    const kickoff = window.setTimeout(update, 0);
    const timer = window.setInterval(update, 1000);

    return () => {
      window.clearTimeout(kickoff);
      window.clearInterval(timer);
    };
  }, [targetIso]);

  return <span>{formatted}</span>;
}

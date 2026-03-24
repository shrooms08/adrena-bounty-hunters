export const formatCountdown = (targetIso: string, nowMs: number): string => {
  const remainingMs = new Date(targetIso).getTime() - nowMs;

  if (remainingMs <= 0) {
    return "00:00";
  }

  const totalSeconds = Math.floor(remainingMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
};

export const formatAgo = (iso: string, nowMs: number): string => {
  const elapsedMs = nowMs - new Date(iso).getTime();
  const minutes = Math.max(1, Math.floor(elapsedMs / 60_000));

  return `${minutes}m ago`;
};

export const formatClock = (iso: string): string => {
  const date = new Date(iso);

  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
};

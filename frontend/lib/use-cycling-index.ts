import { useEffect, useState } from 'react';

export const DEFAULT_CYCLE_INTERVAL_MS = 2600;

export function useCyclingIndex(length: number, intervalMs = DEFAULT_CYCLE_INTERVAL_MS): number {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (length < 2) return;
    const id = setInterval(() => setIndex((i) => Math.min(i + 1, length - 1)), intervalMs);
    return () => clearInterval(id);
  }, [length, intervalMs]);

  return index;
}

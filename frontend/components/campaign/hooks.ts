'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';

const REDUCED_QUERY = '(prefers-reduced-motion: reduce)';

const subscribeReduced = (cb: () => void) => {
  const mq = window.matchMedia(REDUCED_QUERY);
  mq.addEventListener('change', cb);
  return () => mq.removeEventListener('change', cb);
};

export function useReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeReduced,
    () => window.matchMedia(REDUCED_QUERY).matches,
    () => false,
  );
}

export function useStepProgress(count: number, active: boolean, intervalMs: number): number {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setIndex((i) => Math.min(i + 1, count - 1)), intervalMs);
    return () => {
      clearInterval(id);
      setIndex(0);
    };
  }, [active, count, intervalMs]);

  return active ? index : count;
}

export function useCountUp(target: number, durationMs: number): number {
  const reduced = useReducedMotion();
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (reduced) return;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const p = Math.min((now - start) / durationMs, 1);
      setValue(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, durationMs, reduced]);

  return reduced ? target : value;
}

export function useTypedText(text: string, tickMs: number, charsPerTick: number): string {
  const reduced = useReducedMotion();
  const [state, setState] = useState({ source: '', length: 0 });

  useEffect(() => {
    if (reduced) return;
    let length = 0;
    const id = setInterval(() => {
      length = Math.min(length + charsPerTick, text.length);
      setState({ source: text, length });
      if (length >= text.length) clearInterval(id);
    }, tickMs);
    return () => clearInterval(id);
  }, [text, tickMs, charsPerTick, reduced]);

  if (reduced) return text;
  return state.source === text ? text.slice(0, state.length) : '';
}

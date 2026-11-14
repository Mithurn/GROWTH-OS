'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { CLOCK } from './config';

type ClockOptions = { endMs: number; loop: boolean };

export function useVisualClock({ endMs, loop }: ClockOptions) {
  const ref = useRef<HTMLDivElement>(null);
  const [t, setT] = useState(endMs);
  const restartRef = useRef<() => void>(() => {});

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    let timer: ReturnType<typeof setInterval> | undefined;
    let visible = false;
    let elapsed = 0;

    const stop = () => clearInterval(timer);
    const run = () => {
      stop();
      if (reduced.matches) {
        setT(endMs);
        return;
      }
      if (!visible) return;
      const base = performance.now() - elapsed;
      timer = setInterval(() => {
        elapsed = performance.now() - base;
        if (loop) {
          elapsed %= endMs;
          setT(elapsed);
        } else if (elapsed >= endMs) {
          setT(endMs);
          stop();
        } else {
          setT(elapsed);
        }
      }, CLOCK.stepMs);
    };

    restartRef.current = () => {
      if (loop) return;
      elapsed = 0;
      setT(0);
      run();
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting;
        if (visible && !loop && elapsed === 0) setT(0);
        run();
      },
      { threshold: CLOCK.visibleThreshold },
    );
    observer.observe(node);
    reduced.addEventListener('change', run);
    return () => {
      stop();
      observer.disconnect();
      reduced.removeEventListener('change', run);
    };
  }, [endMs, loop]);

  const replay = useCallback(() => restartRef.current(), []);
  return { ref, t, replay };
}

export function progress(t: number, from: number, to: number) {
  return Math.min(1, Math.max(0, (t - from) / (to - from)));
}

export function easeOut(p: number) {
  return 1 - (1 - p) ** 3;
}

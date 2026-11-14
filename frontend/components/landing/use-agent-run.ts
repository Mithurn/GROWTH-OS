'use client';

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { CONSOLE, RUN_TIMING } from './config';

const { command, lines } = CONSOLE;
const typeEnd = Math.ceil(command.length / RUN_TIMING.charsPerTick);
const linesStart = typeEnd + RUN_TIMING.pauseTicks;
const linesEnd = linesStart + lines.length * RUN_TIMING.lineTicks;
const lastTick = linesEnd + RUN_TIMING.resultTicks;

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

function subscribeReducedMotion(onChange: () => void) {
  const query = window.matchMedia(REDUCED_MOTION_QUERY);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}

export function usePrefersReducedMotion() {
  return useSyncExternalStore(
    subscribeReducedMotion,
    () => window.matchMedia(REDUCED_MOTION_QUERY).matches,
    () => false,
  );
}

export function useAgentRun() {
  const reduced = usePrefersReducedMotion();
  const [tick, setTick] = useState(0);
  const [runId, setRunId] = useState(0);

  useEffect(() => {
    if (reduced) return;
    const id = setInterval(() => {
      setTick((t) => {
        if (t >= lastTick) {
          clearInterval(id);
          return t;
        }
        return t + 1;
      });
    }, RUN_TIMING.tickMs);
    return () => clearInterval(id);
  }, [reduced, runId]);

  const current = reduced ? lastTick : tick;
  const typed = Math.min(command.length, current * RUN_TIMING.charsPerTick);
  const visibleLines = Math.max(0, Math.min(lines.length, Math.floor((current - linesStart) / RUN_TIMING.lineTicks) + 1));
  const done = current >= linesEnd;
  const showResult = current >= lastTick;
  const activeStage = visibleLines === 0 ? -1 : lines[visibleLines - 1].stage;
  const replay = useCallback(() => {
    setTick(0);
    setRunId((n) => n + 1);
  }, []);

  return { typed, visibleLines, done, showResult, activeStage, typing: current < typeEnd, replay };
}

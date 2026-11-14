'use client';

import { useBackendStatus } from '@/lib/use-backend-status';

const COPY = {
  checking: { dot: 'bg-zinc-500', text: 'Checking the live backend' },
  online: { dot: 'bg-emerald-400', text: 'Live backend is running. Sign in with your own data.' },
  offline: { dot: 'bg-amber-400', text: 'Live backend is asleep to save costs. The demo is always on.' },
} as const;

export function BackendStatusPill() {
  const { dot, text } = COPY[useBackendStatus()];
  return (
    <p
      className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-1.5 text-xs font-medium text-zinc-300 backdrop-blur"
      role="status"
    >
      <span className={`size-1.5 rounded-full ${dot}`} aria-hidden />
      {text}
    </p>
  );
}

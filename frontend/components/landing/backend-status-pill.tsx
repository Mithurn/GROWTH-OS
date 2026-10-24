'use client';

import { useBackendStatus } from '@/lib/use-backend-status';

const COPY = {
  checking: { dot: 'bg-[#9CA3AF]', text: 'Checking the live backend…' },
  online: { dot: 'bg-emerald-500', text: 'Live backend is running. Sign in with your own data.' },
  offline: { dot: 'bg-amber-500', text: 'Live backend is asleep to save costs. The demo is always on.' },
} as const;

export function BackendStatusPill() {
  const { dot, text } = COPY[useBackendStatus()];
  return (
    <p
      className="mx-auto inline-flex items-center gap-2 rounded-full border border-[#E5E7EB] bg-white px-3 py-1 text-xs font-medium text-[#4B5563]"
      role="status"
    >
      <span className={`h-2 w-2 rounded-full ${dot}`} aria-hidden />
      {text}
    </p>
  );
}

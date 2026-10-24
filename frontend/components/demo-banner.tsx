'use client';

import { enterDemo, exitDemo } from '@/lib/demo/mode';
import { useIsDemo } from '@/lib/demo/use-demo';
import { useBackendStatus } from '@/lib/use-backend-status';

/**
 * Sits above the app chrome. In demo mode it says nothing is real; otherwise it appears
 * only when the live backend is asleep and offers the demo instead of a broken page.
 */
export function DemoBanner() {
  const demo = useIsDemo();
  const status = useBackendStatus();

  if (demo) {
    return (
      <div className="flex items-center justify-center gap-3 bg-[#111827] px-4 py-2 text-xs text-white">
        <span>Demo mode: sample data, nothing is sent.</span>
        <button
          type="button"
          onClick={exitDemo}
          className="cursor-pointer rounded-full bg-white/15 px-3 py-1 font-medium hover:bg-white/25"
        >
          Exit demo
        </button>
      </div>
    );
  }

  if (status !== 'offline') return null;

  return (
    <div className="flex flex-wrap items-center justify-center gap-3 bg-amber-50 px-4 py-2 text-xs text-amber-900">
      <span>The live backend is asleep to save hosting costs, so real data will not load.</span>
      <button
        type="button"
        onClick={enterDemo}
        className="cursor-pointer rounded-full bg-amber-900 px-3 py-1 font-medium text-white hover:bg-amber-800"
      >
        Explore the demo
      </button>
    </div>
  );
}

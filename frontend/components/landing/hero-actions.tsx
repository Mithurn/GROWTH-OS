'use client';

import Link from 'next/link';
import { enterDemo } from '@/lib/demo/mode';
import { useBackendStatus } from '@/lib/use-backend-status';

const PRIMARY =
  'w-full rounded-lg bg-[#5B4FFF] px-6 py-3 text-base font-semibold text-white transition-colors hover:bg-[#4B3FE5] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5B4FFF] sm:w-auto';
const SECONDARY =
  'w-full rounded-lg border border-[#E5E7EB] bg-white px-6 py-3 text-base font-semibold text-[#111827] transition-colors hover:bg-[#F9FAFB] sm:w-auto';

/**
 * The real app needs the AWS backend, which is only up on request. While it is asleep the
 * demo is the main action; once it answers, signing up with your own data takes over.
 */
export function HeroActions({ light = false }: { light?: boolean }) {
  const status = useBackendStatus();
  const live = status === 'online';

  return (
    <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
      {live ? (
        <>
          <Link href="/login?mode=signup" className={PRIMARY}>
            Create account
          </Link>
          <button type="button" onClick={enterDemo} className={light ? 'w-full cursor-pointer rounded-lg bg-white/10 px-6 py-3 text-base font-semibold text-white hover:bg-white/20 sm:w-auto' : `${SECONDARY} cursor-pointer`}>
            Try the demo
          </button>
        </>
      ) : (
        <>
          <button type="button" onClick={enterDemo} className={`${PRIMARY} cursor-pointer`}>
            Try the live demo
          </button>
          <Link href="/login" className={light ? 'w-full rounded-lg bg-white/10 px-6 py-3 text-base font-semibold text-white hover:bg-white/20 sm:w-auto' : SECONDARY}>
            Sign in
          </Link>
        </>
      )}
    </div>
  );
}

'use client';

import { useSyncExternalStore, type ReactElement } from 'react';
import Link from 'next/link';
import { MetalFx } from 'metal-fx';
import { enterDemo } from '@/lib/demo/mode';
import { useBackendStatus } from '@/lib/use-backend-status';

const PRIMARY =
  'inline-flex h-12 cursor-pointer items-center justify-center rounded-full bg-[#0c0c14] px-7 text-[15px] font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-indigo-400';
const SECONDARY =
  'inline-flex h-12 cursor-pointer items-center justify-center rounded-full border border-white/10 bg-white/[0.03] px-7 text-[15px] font-medium text-zinc-200 transition-colors hover:border-white/20 hover:bg-white/[0.07] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-indigo-400';

const subscribeNever = () => () => {};

function MetalCta({ children }: { children: ReactElement }) {
  const mounted = useSyncExternalStore(subscribeNever, () => true, () => false);
  return mounted ? (
    <MetalFx variant="button" preset="silver" theme="dark">
      {children}
    </MetalFx>
  ) : (
    children
  );
}

/**
 * The real app needs the AWS backend, which is only up on request. While it is asleep the
 * demo is the main action; once it answers, signing up with your own data takes over.
 */
export function HeroActions() {
  const live = useBackendStatus() === 'online';

  return (
    <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
      {live ? (
        <>
          <MetalCta>
            <Link href="/login?mode=signup" className={PRIMARY}>
              Create account
            </Link>
          </MetalCta>
          <button type="button" onClick={enterDemo} className={SECONDARY}>
            Try the demo
          </button>
        </>
      ) : (
        <>
          <MetalCta>
            <button type="button" onClick={enterDemo} className={PRIMARY}>
              Try the live demo
            </button>
          </MetalCta>
          <Link href="/login" className={SECONDARY}>
            Sign in
          </Link>
        </>
      )}
    </div>
  );
}

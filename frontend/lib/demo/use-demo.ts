'use client';

import { useSyncExternalStore } from 'react';
import { isDemo } from './mode';

const subscribe = () => () => undefined;

/** Demo flag that is `false` during server render and hydration, then the cookie's value. */
export function useIsDemo(): boolean {
  return useSyncExternalStore(subscribe, isDemo, () => false);
}

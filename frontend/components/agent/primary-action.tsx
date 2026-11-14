'use client';

import Link from 'next/link';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { MetalFx } from 'metal-fx';
import { cn } from '@/lib/utils';
import { useReducedMotion } from '@/lib/use-reduced-motion';

export const PRIMARY_ACTION_CLASS =
  'inline-flex h-10 items-center justify-center gap-2 rounded-full bg-[#141929] px-5 text-sm font-medium text-white transition-colors hover:bg-[#0A0E1A] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5B4FFF] disabled:opacity-50';

const METAL_STRENGTH = 0.8;

type PrimaryActionProps = {
  href?: string;
  children: ReactNode;
  className?: string;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children' | 'className'>;

export function PrimaryAction({ href, children, className, ...buttonProps }: PrimaryActionProps) {
  const reduced = useReducedMotion();
  const classes = cn(PRIMARY_ACTION_CLASS, className);
  const host = href ? (
    <Link href={href} className={classes}>
      {children}
    </Link>
  ) : (
    <button type="button" className={classes} {...buttonProps}>
      {children}
    </button>
  );

  if (reduced) return host;
  return (
    <MetalFx variant="button" preset="silver" theme="dark" strength={METAL_STRENGTH} className="inline-flex">
      {host}
    </MetalFx>
  );
}

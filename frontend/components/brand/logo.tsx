import Image from 'next/image';

const BRAND_NAME = 'GrowthOS';
const MARK_SRC = '/logo-mark.svg';
const WORDMARK_SRC = { dark: '/logo-wordmark-dark.svg', light: '/logo-wordmark.svg' } as const;
const WORDMARK_ASPECT = 277 / 64;
export const DEFAULT_LOGO_HEIGHT = 28;

interface LogoProps {
  variant?: 'full' | 'mark';
  surface?: 'dark' | 'light';
  height?: number;
  className?: string;
}

export function Logo({ variant = 'full', surface = 'dark', height = DEFAULT_LOGO_HEIGHT, className }: LogoProps) {
  const isMark = variant === 'mark';
  const src = isMark ? MARK_SRC : WORDMARK_SRC[surface];
  const width = Math.round(isMark ? height : height * WORDMARK_ASPECT);
  return <Image src={src} alt={BRAND_NAME} width={width} height={height} unoptimized className={className} />;
}

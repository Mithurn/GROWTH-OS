import { cn } from '@/lib/utils';

const ORB_SIZES = {
  sm: 'size-6',
  md: 'size-12',
  lg: 'size-20',
} as const;

export type AiOrbSize = keyof typeof ORB_SIZES;

export function AiOrb({ size = 'md', className }: { size?: AiOrbSize; className?: string }) {
  return (
    <span aria-hidden className={cn('ai-orb', ORB_SIZES[size], className)}>
      <span className="ai-orb-halo" />
      <span className="ai-orb-core" />
    </span>
  );
}

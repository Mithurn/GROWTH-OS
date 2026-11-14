'use client';

import { cn } from '@/lib/utils';
import { CHANNELS, CHANNEL_META, type Channel } from './config';

type ChannelTabsProps = {
  value: Channel;
  onChange: (channel: Channel) => void;
  disabled?: boolean;
  className?: string;
};

export function ChannelTabs({ value, onChange, disabled, className }: ChannelTabsProps) {
  return (
    <div role="tablist" aria-label="Channel" className={cn('inline-flex rounded-xl bg-muted p-1', className)}>
      {CHANNELS.map((ch) => {
        const { icon: Icon } = CHANNEL_META[ch];
        const active = value === ch;
        return (
          <button
            key={ch}
            type="button"
            role="tab"
            aria-selected={active}
            disabled={disabled}
            onClick={() => !active && onChange(ch)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-60',
              active ? 'bg-white text-foreground shadow-sm ring-1 ring-black/5' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Icon className={cn('size-3.5', active && 'text-primary')} aria-hidden /> {ch}
          </button>
        );
      })}
    </div>
  );
}

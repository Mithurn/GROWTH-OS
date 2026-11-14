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
    <div role="tablist" aria-label="Channel" className={cn('inline-flex rounded-xl bg-[#F3F4F6] p-1', className)}>
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
              'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all disabled:opacity-60',
              active ? 'bg-white text-[#1A1A1A] shadow-sm ring-1 ring-black/5' : 'text-[#6B7280] hover:text-[#1A1A1A]',
            )}
          >
            <Icon className={cn('size-3.5', active && 'text-[#5B4FFF]')} aria-hidden /> {ch}
          </button>
        );
      })}
    </div>
  );
}

'use client';

import { useState } from 'react';
import { BorderBeam } from 'border-beam';
import { ArrowUp, Loader2 } from 'lucide-react';
import { AiOrb } from '@/components/ui/ai-orb';
import { cn } from '@/lib/utils';
import { REFINE_CHIPS } from './config';

type RefineBarProps = {
  busy: boolean;
  onRefine: (instruction: string) => Promise<boolean>;
  className?: string;
};

export function RefineBar({ busy, onRefine, className }: RefineBarProps) {
  const [value, setValue] = useState('');
  const [focused, setFocused] = useState(false);

  const submit = async (text: string) => {
    const instruction = text.trim();
    if (!instruction || busy) return;
    if (await onRefine(instruction)) setValue('');
  };

  return (
    <div className={cn('space-y-3', className)}>
      <BorderBeam size="sm" theme="light" colorVariant="ocean" strength={0.8} active={focused || busy}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submit(value);
          }}
          className="flex items-center gap-2 rounded-xl border border-[#E5E7EB] bg-white py-1.5 pl-3.5 pr-1.5"
        >
          <AiOrb size="sm" state={busy ? 'composing' : focused ? 'listening' : 'breathing'} className="shrink-0" />
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            disabled={busy}
            aria-label="Refine this campaign with AI"
            placeholder={busy ? 'Rewriting the draft' : 'Tell the agent what to change'}
            className="min-w-0 flex-1 bg-transparent py-1.5 text-sm text-[#1A1A1A] outline-none placeholder:text-[#9CA3AF] disabled:cursor-not-allowed"
          />
          <button
            type="submit"
            disabled={!value.trim() || busy}
            aria-label="Send instruction"
            className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[#141929] text-white transition-colors hover:bg-[#0A0E1A] disabled:bg-[#F3F4F6] disabled:text-[#9CA3AF]"
          >
            {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <ArrowUp className="size-4" aria-hidden />}
          </button>
        </form>
      </BorderBeam>
      <div className="flex flex-wrap gap-1.5">
        {REFINE_CHIPS.map((chip) => (
          <button
            key={chip}
            type="button"
            disabled={busy}
            onClick={() => void submit(chip)}
            className="rounded-full border border-[#E5E7EB] bg-white px-3 py-1 text-xs font-medium text-[#4B5563] transition-colors hover:border-[#5B4FFF]/40 hover:bg-[#EEF2FF] hover:text-[#4B3FE5] disabled:opacity-50"
          >
            {chip}
          </button>
        ))}
      </div>
    </div>
  );
}

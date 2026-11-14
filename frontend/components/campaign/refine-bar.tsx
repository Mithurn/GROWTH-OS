'use client';

import { useState } from 'react';
import { BorderBeam } from 'border-beam';
import { ArrowUp, Loader2, Sparkles } from 'lucide-react';
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
      <BorderBeam size="sm" theme="dark" colorVariant="ocean" strength={1} active={focused || busy}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submit(value);
          }}
          className="flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-950 py-1.5 pl-3 pr-1.5 text-zinc-50"
        >
          <Sparkles className="size-4 shrink-0 text-primary" aria-hidden />
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            disabled={busy}
            aria-label="Refine this campaign with AI"
            placeholder={busy ? 'Rewriting the draft' : 'Tell the agent what to change'}
            className="min-w-0 flex-1 bg-transparent py-1.5 text-sm outline-none placeholder:text-zinc-500 disabled:cursor-not-allowed"
          />
          <button
            type="submit"
            disabled={!value.trim() || busy}
            aria-label="Send instruction"
            className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-colors hover:bg-primary/90 disabled:bg-zinc-800 disabled:text-zinc-500"
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
            className="rounded-full border border-border bg-card px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary disabled:opacity-50"
          >
            {chip}
          </button>
        ))}
      </div>
    </div>
  );
}

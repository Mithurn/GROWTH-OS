'use client';

import { useState } from 'react';
import { ArrowUp, Loader2, Sparkles } from 'lucide-react';
import { BorderBeam } from 'border-beam';
import { cn } from '@/lib/utils';
import { useLoopingIndex } from '@/lib/use-cycling-index';
import { useReducedMotion } from '@/lib/use-reduced-motion';
import { PROMPT_DEFAULTS } from './agent-config';

type AgentPromptInputProps = {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (value: string) => void;
  busy?: boolean;
  placeholders?: readonly string[];
  suggestions?: readonly string[];
  error?: string | null;
  label?: string;
  maxLength?: number;
  className?: string;
};

export function AgentPromptInput({
  value,
  onChange,
  onSubmit,
  busy = false,
  placeholders = ['Describe a goal for the agent'],
  suggestions = [],
  error,
  label = 'Goal for the agent',
  maxLength = PROMPT_DEFAULTS.maxLength,
  className,
}: AgentPromptInputProps) {
  const [focused, setFocused] = useState(false);
  const reduced = useReducedMotion();
  const placeholderIndex = useLoopingIndex(placeholders.length, PROMPT_DEFAULTS.placeholderIntervalMs);
  const canSubmit = value.trim().length > 0 && !busy;

  const submit = () => {
    if (canSubmit) onSubmit(value.trim());
  };

  return (
    <div className={cn('w-full', className)}>
      <BorderBeam size="md" colorVariant="ocean" theme="light" active={(busy || focused) && !reduced} strength={busy ? 1 : 0.6}>
        <div
          className={cn(
            'flex items-center gap-3 rounded-2xl border bg-white px-4 py-3 transition-colors',
            focused || busy ? 'border-transparent' : 'border-[#E5E7EB]',
          )}
        >
          <Sparkles className="size-4 shrink-0 text-[#5B4FFF]" aria-hidden />
          <input
            type="text"
            value={value}
            maxLength={maxLength}
            disabled={busy}
            aria-label={label}
            placeholder={placeholders[placeholderIndex]}
            onChange={(e) => onChange(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            className="min-w-0 flex-1 bg-transparent text-sm text-[#1A1A1A] outline-none placeholder:text-[#9CA3AF]"
          />
          <button
            type="button"
            onClick={submit}
            disabled={!canSubmit}
            aria-label={busy ? 'Agent is working' : 'Send goal to agent'}
            className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[#5B4FFF] text-white transition-colors hover:bg-[#4B3FE5] disabled:bg-[#E5E7EB] disabled:text-[#9CA3AF]"
          >
            {busy ? <Loader2 className="size-4 motion-safe:animate-spin" aria-hidden /> : <ArrowUp className="size-4" aria-hidden />}
          </button>
        </div>
      </BorderBeam>
      {suggestions.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {suggestions.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              disabled={busy}
              onClick={() => onChange(suggestion)}
              className="rounded-full border border-[#E5E7EB] bg-white px-3 py-1 text-xs text-[#4B5563] transition-colors hover:border-[#C7D2FE] hover:bg-[#F8F7FF] hover:text-[#4B3FE5] disabled:opacity-50"
            >
              {suggestion}
            </button>
          ))}
        </div>
      )}
      {error && (
        <p role="alert" className="mt-3 text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}

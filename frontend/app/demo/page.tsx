'use client';

import { useEffect } from 'react';
import { AiOrb } from '@/components/ui/ai-orb';
import { enterDemo } from '@/lib/demo/mode';

export default function DemoEntryPage() {
  useEffect(enterDemo, []);
  return (
    <div role="status" aria-live="polite" className="flex min-h-screen flex-col items-center justify-center gap-5 bg-ink-deep">
      <AiOrb size="lg" state="working" theme="dark" />
      <p className="text-base font-semibold text-zinc-300">Opening the demo</p>
    </div>
  );
}

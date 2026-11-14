'use client';

import { AiLoader } from '@/components/ui/ai-loader';
import { useEffect } from 'react';
import { enterDemo } from '@/lib/demo/mode';

export default function DemoEntryPage() {
  useEffect(enterDemo, []);
  return (
    <div className="flex min-h-screen items-center justify-center bg-white">
      <AiLoader size="md" title="Opening the demo" />
    </div>
  );
}

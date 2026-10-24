'use client';

import { useEffect } from 'react';
import { enterDemo } from '@/lib/demo/mode';

export default function DemoEntryPage() {
  useEffect(enterDemo, []);
  return <p className="p-10 text-center text-sm text-[#6B7280]">Loading the demo…</p>;
}

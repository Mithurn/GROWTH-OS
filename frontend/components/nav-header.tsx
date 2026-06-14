'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV_ITEMS = [
  { label: 'Overview', href: '/' },
  { label: 'Opportunities', href: '/opportunities' },
  { label: 'Analytics', href: '/analytics' },
];

export function NavHeader() {
  const pathname = usePathname();
  const [mode, setMode] = useState<'operator' | 'autonomous'>('operator');

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-[#E5E7EB]">
      <div className="max-w-[1600px] mx-auto px-6 h-16 grid grid-cols-3 items-center">

        {/* Left: Logo */}
        <Link href="/" className="flex items-center gap-1.5">
          <div className="flex flex-wrap w-5 h-5 gap-0.5">
            <div className="w-[9px] h-[9px] rounded-full bg-[#3B82F6]" />
            <div className="w-[9px] h-[9px] rounded-full bg-[#3B82F6]" />
            <div className="w-[9px] h-[9px] rounded-full bg-[#3B82F6]" />
            <div className="w-[9px] h-[9px] rounded-full bg-[#3B82F6]" />
          </div>
          <span className="text-[22px] font-semibold text-[#3B82F6] tracking-tight leading-none">xeno</span>
        </Link>

        {/* Center: Navigation */}
        <nav className="flex items-center justify-center gap-1">
          {NAV_ITEMS.map((item) => {
            const isActive =
              item.href === '/'
                ? pathname === '/'
                : pathname.startsWith(item.href);

            return (
              <Link
                key={item.label}
                href={item.href}
                className={`px-4 py-1.5 text-[13px] font-medium transition-all rounded-full ${
                  isActive
                    ? 'bg-[#EEF2FF] text-[#5B4FFF]'
                    : 'text-[#6B7280] hover:text-[#1A1A1A] hover:bg-[#F3F4F6]'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Right: Mode Toggle + Avatar */}
        <div className="flex items-center justify-end gap-4">
          <div className="flex bg-[#FAFAFA] border border-[#E5E7EB] rounded-full p-0.5">
            <button
              onClick={() => setMode('operator')}
              className={`text-xs px-4 py-1.5 rounded-full font-medium transition-all ${
                mode === 'operator'
                  ? 'bg-[#1A1A1A] text-white shadow-sm'
                  : 'text-[#6B7280] hover:text-[#1A1A1A]'
              }`}
            >
              Operator
            </button>
            <button
              onClick={() => setMode('autonomous')}
              className={`text-xs px-4 py-1.5 rounded-full font-medium transition-all ${
                mode === 'autonomous'
                  ? 'bg-[#1A1A1A] text-white shadow-sm'
                  : 'text-[#6B7280] hover:text-[#1A1A1A]'
              }`}
            >
              Autonomous
            </button>
          </div>
          <div className="h-8 w-8 rounded-full bg-[#5B4FFF] flex items-center justify-center text-white text-sm font-medium shadow-sm ring-2 ring-white">
            U
          </div>
        </div>

      </div>
    </header>
  );
}

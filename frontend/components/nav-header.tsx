'use client';

import { useState } from 'react';
import Image from 'next/image';
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

  const dark = pathname.startsWith('/analytics');

  const headerStyle = dark
    ? { background: 'rgba(10,14,26,0.92)', borderColor: 'rgba(255,255,255,0.08)', backdropFilter: 'blur(16px)' }
    : { background: 'rgba(255,255,255,0.95)', borderColor: '#E5E7EB', backdropFilter: 'blur(8px)' };

  return (
    <header className="sticky top-0 z-50 border-b" style={headerStyle}>
      <div className="max-w-[1600px] mx-auto px-6 h-16 grid grid-cols-3 items-center">

        {/* Left: Logo */}
        <Link href="/" className="flex items-center">
          <Image src="/logo.png" alt="Xeno" width={80} height={32} className="object-contain" />
        </Link>

        {/* Center: Navigation */}
        <nav className="flex items-center justify-center gap-1">
          {NAV_ITEMS.map((item) => {
            const isActive =
              item.href === '/'
                ? pathname === '/'
                : pathname.startsWith(item.href);

            if (dark) {
              return (
                <Link
                  key={item.label}
                  href={item.href}
                  className={`px-4 py-1.5 text-[13px] font-medium transition-all rounded-full ${
                    isActive ? 'text-white' : 'text-[#8B92A5] hover:text-white hover:bg-white/5'
                  }`}
                  style={isActive ? { background: 'rgba(91,79,255,0.18)', color: '#A89DFF' } : {}}
                >
                  {item.label}
                </Link>
              );
            }

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
          <div
            className="flex rounded-full p-0.5"
            style={dark
              ? { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }
              : { background: '#FAFAFA', border: '1px solid #E5E7EB' }}
          >
            <button
              onClick={() => setMode('operator')}
              className={`text-xs px-4 py-1.5 rounded-full font-medium transition-all ${
                mode === 'operator'
                  ? 'text-white shadow-sm'
                  : dark ? 'text-[#8B92A5] hover:text-white' : 'text-[#6B7280] hover:text-[#1A1A1A]'
              }`}
              style={mode === 'operator' ? { background: dark ? 'linear-gradient(135deg, #5B4FFF, #7C6FFF)' : '#1A1A1A' } : {}}
            >
              Operator
            </button>
            <button
              onClick={() => setMode('autonomous')}
              className={`text-xs px-4 py-1.5 rounded-full font-medium transition-all ${
                mode === 'autonomous'
                  ? 'text-white shadow-sm'
                  : dark ? 'text-[#8B92A5] hover:text-white' : 'text-[#6B7280] hover:text-[#1A1A1A]'
              }`}
              style={mode === 'autonomous' ? { background: dark ? 'linear-gradient(135deg, #5B4FFF, #7C6FFF)' : '#1A1A1A' } : {}}
            >
              Autonomous
            </button>
          </div>
          <div className={`h-8 w-8 rounded-full bg-[#5B4FFF] flex items-center justify-center text-white text-sm font-medium shadow-sm ${dark ? 'ring-2 ring-white/10' : 'ring-2 ring-white'}`}>
            U
          </div>
        </div>

      </div>
    </header>
  );
}

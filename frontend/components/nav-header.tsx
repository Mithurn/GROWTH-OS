'use client';

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

        {/* Right: placeholder for alignment */}
        <div />

      </div>
    </header>
  );
}

'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { User } from '@supabase/supabase-js';

const NAV_ITEMS = [
  { label: 'Overview', href: '/' },
  { label: 'Opportunities', href: '/opportunities' },
  { label: 'Analytics', href: '/analytics' },
];

export function NavHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
  }, []);

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  const initials = user?.email?.slice(0, 2).toUpperCase() ?? '?';

  const dark = pathname.startsWith('/analytics');

  const headerStyle = dark
    ? { background: 'rgba(10,14,26,0.92)', borderColor: 'rgba(255,255,255,0.08)', backdropFilter: 'blur(16px)' }
    : { background: 'rgba(255,255,255,0.95)', borderColor: '#E5E7EB', backdropFilter: 'blur(8px)' };

  return (
    <header className="sticky top-0 z-50 border-b" style={headerStyle}>
      <div className="max-w-[1600px] mx-auto px-6 h-16 grid grid-cols-3 items-center">

        {/* Left: Logo */}
        <Link href="/" className="flex items-center">
          <Image src="/logo.png" alt="GrowthOS" width={80} height={32} className="object-contain" />
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

        {/* Right: User menu */}
        <div className="flex justify-end">
          {user && (
            <div className="relative">
              <button
                onClick={() => setMenuOpen(o => !o)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                  dark
                    ? 'text-[#8B92A5] hover:bg-white/5'
                    : 'text-[#6B7280] hover:bg-[#F3F4F6]'
                }`}
              >
                <span
                  className="h-7 w-7 rounded-full flex items-center justify-center text-[11px] font-bold text-white shrink-0"
                  style={{ background: '#5B4FFF' }}
                >
                  {initials}
                </span>
                <span className="max-w-[120px] truncate hidden sm:block">{user.email}</span>
              </button>

              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                  <div className="absolute right-0 top-10 z-50 w-52 bg-white border border-[#E5E7EB] rounded-xl shadow-lg py-1 overflow-hidden">
                    <div className="px-4 py-2.5 border-b border-[#E5E7EB]">
                      <p className="text-xs font-medium text-[#1A1A1A] truncate">{user.email}</p>
                      <p className="text-[11px] text-[#9CA3AF] mt-0.5">GrowthOS Workspace</p>
                    </div>
                    <button
                      onClick={handleSignOut}
                      className="w-full text-left px-4 py-2.5 text-sm text-[#EF4444] hover:bg-red-50 transition-colors"
                    >
                      Sign out
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

      </div>
    </header>
  );
}

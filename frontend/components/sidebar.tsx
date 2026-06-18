'use client';

import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import {
  Activity,
  BarChart3,
  Building2,
  ChevronDown,
  Home,
  Send,
  Settings,
  Users,
  Zap,
} from 'lucide-react';

const navItems = [
  {
    name: 'Home',
    href: '/',
    icon: Home,
  },
  {
    name: 'Opportunities',
    href: '/opportunities',
    icon: Zap,
  },
  {
    name: 'Campaigns',
    href: '/campaigns',
    icon: Send,
  },
  {
    name: 'Analytics',
    href: '/analytics',
    icon: BarChart3,
  },
  {
    name: 'Customers',
    href: '/intelligence',
    icon: Users,
  },
  {
    name: 'Settings',
    href: '/settings',
    icon: Settings,
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <div className="fixed left-0 top-0 h-screen w-64 overflow-hidden border-r border-[#E4E4E7] bg-[#FAFAFA] shadow-sm">
      <div className="flex h-full flex-col">
        <div className="px-6 py-7">
          <div className="flex items-center gap-3">
            <div className="relative h-[30px] w-[132px]">
              <Image src="/logo.png" alt="GrowthOS" fill priority sizes="132px" className="object-contain object-left" />
            </div>
          </div>
        </div>

        <nav className="space-y-1 px-3">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              pathname === item.href ||
              (item.href === '/opportunities' && pathname.startsWith('/opportunities'));

            return (
              <button
                key={item.href}
                onClick={() => router.push(item.href)}
                className={`group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-all duration-200 ${
                  isActive
                    ? 'bg-[#5B4FFF] text-white shadow-sm'
                    : 'text-[#71717A] hover:bg-[#F4F4F5] hover:text-[#1A1A1A]'
                }`}
              >
                <Icon
                  className={`h-4.5 w-4.5 transition-colors ${
                    isActive ? 'text-white' : 'text-[#A1A1AA] group-hover:text-[#1A1A1A]'
                  }`}
                />
                <span className={`text-sm ${isActive ? 'font-semibold' : 'font-medium'}`}>
                  {item.name}
                </span>
              </button>
            );
          })}
        </nav>

        <div className="mt-auto space-y-3 p-3">
          <button className="w-full rounded-lg border border-[#E4E4E7] bg-white p-3 text-left transition hover:bg-[#F9F9F9]">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#F4F4F5]">
                  <Building2 className="h-4 w-4 text-[#71717A]" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-[#1A1A1A]">Your Brand</p>
                  <p className="mt-0.5 text-xs text-[#A1A1AA]">Style Studio</p>
                </div>
              </div>
              <ChevronDown className="h-4 w-4 text-[#A1A1AA]" />
            </div>
          </button>

          <div className="rounded-lg border border-[#E4E4E7] bg-white p-3">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-[#22C55E]" />
              <p className="text-sm font-semibold text-[#1A1A1A]">Data Health</p>
            </div>
            <div className="mt-2 flex items-center gap-2 text-xs font-semibold text-[#22C55E]">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#22C55E]" />
              Excellent
            </div>
            <div className="mt-2 h-px w-12 bg-[#E4E4E7]" />
            <p className="mt-2 text-xs text-[#A1A1AA]">Last updated<br />2 mins ago</p>
          </div>
        </div>
      </div>
    </div>
  );
}

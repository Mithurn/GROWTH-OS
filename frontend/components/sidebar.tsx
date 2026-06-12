'use client';

import { usePathname, useRouter } from 'next/navigation';
import { Target, Brain, Rocket, BarChart3 } from 'lucide-react';

const navItems = [
  {
    name: 'Opportunities',
    href: '/opportunities',
    icon: Target,
  },
  {
    name: 'Customer Intelligence',
    href: '/intelligence',
    icon: Brain,
  },
  {
    name: 'Campaign Studio',
    href: '/campaigns',
    icon: Rocket,
  },
  {
    name: 'Analytics',
    href: '/analytics',
    icon: BarChart3,
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <div className="fixed left-0 top-0 h-screen w-64 border-r border-amber-200/50 bg-gradient-to-b from-amber-50/80 to-white/95 backdrop-blur-sm">
      {/* Header */}
      <div className="border-b border-amber-200/50 px-6 py-5">
        <h1 className="text-xl font-semibold tracking-tight text-stone-900">
          Xeno Growth Agent
        </h1>
        <p className="mt-1 text-xs text-stone-500">AI-Powered CRM Intelligence</p>
      </div>

      {/* Navigation */}
      <nav className="space-y-1 p-4">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;

          return (
            <button
              key={item.href}
              onClick={() => router.push(item.href)}
              className={`group flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left transition-all ${
                isActive
                  ? 'bg-gradient-to-r from-amber-100 to-amber-50 text-amber-900 shadow-sm'
                  : 'text-stone-600 hover:bg-amber-50/50 hover:text-stone-900'
              }`}
            >
              <Icon
                className={`h-5 w-5 transition-colors ${
                  isActive ? 'text-amber-600' : 'text-stone-400 group-hover:text-amber-500'
                }`}
              />
              <span className={`text-sm font-medium ${isActive ? 'font-semibold' : ''}`}>
                {item.name}
              </span>
            </button>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="absolute bottom-0 left-0 right-0 border-t border-amber-200/50 p-4">
        <div className="rounded-lg bg-amber-50 px-3 py-2">
          <p className="text-xs font-medium text-amber-900">AI Engine Active</p>
          <p className="mt-0.5 text-xs text-amber-700">Analyzing customer behavior</p>
        </div>
      </div>
    </div>
  );
}

'use client';

import { usePathname } from 'next/navigation';
import { AppSidebar } from './app-sidebar';
import { CommandPalette } from './command-palette';
import { DemoBanner } from './demo-banner';

const STANDALONE_PREFIXES = ['/onboarding', '/login', '/demo', '/auth'];

export function MainLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isStandalone = pathname === '/' || STANDALONE_PREFIXES.some((prefix) => pathname.startsWith(prefix));

  if (isStandalone) {
    return <>{children}</>;
  }

  return (
    <div className="flex h-dvh flex-col bg-surface-inset">
      <DemoBanner />
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <AppSidebar />
        <main className="flex min-w-0 flex-1 flex-col overflow-y-auto">{children}</main>
      </div>
      <CommandPalette />
    </div>
  );
}

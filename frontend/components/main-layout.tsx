'use client';

import { usePathname } from 'next/navigation';
import { NavHeader } from './nav-header';

export function MainLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  if (pathname.startsWith('/onboarding')) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-[#FAFAFA] flex flex-col">
      <NavHeader />
      <main className="flex-1 flex flex-col">{children}</main>
    </div>
  );
}

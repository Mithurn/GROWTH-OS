'use client';

import { usePathname } from 'next/navigation';
import { NavHeader } from './nav-header';

export function MainLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // The landing page and the auth/onboarding flows carry their own chrome — the app
  // nav would be misleading there, since the visitor may not be signed in at all.
  const isStandalone =
    pathname === '/' ||
    pathname.startsWith('/onboarding') ||
    pathname.startsWith('/login') ||
    pathname.startsWith('/auth');

  if (isStandalone) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-[#FAFAFA] flex flex-col">
      <NavHeader />
      <main className="flex-1 flex flex-col">{children}</main>
    </div>
  );
}

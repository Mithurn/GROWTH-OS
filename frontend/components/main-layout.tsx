'use client';

import { usePathname } from 'next/navigation';
import { Sidebar } from './sidebar';

export function MainLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // Pages that should NOT show the sidebar
  const noSidebarPages = ['/onboarding', '/test'];
  const showSidebar = !noSidebarPages.includes(pathname);

  if (!showSidebar) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="ml-64 flex-1">{children}</main>
    </div>
  );
}

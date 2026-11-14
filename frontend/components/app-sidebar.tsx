'use client';

import { Logo } from '@/components/brand/logo';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { LogOut, Menu, Search, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { clearApiCache } from '@/lib/api';
import { exitDemo, isDemo } from '@/lib/demo/mode';
import { useIsDemo } from '@/lib/demo/use-demo';
import { useBackendStatus } from '@/lib/use-backend-status';
import { cn } from '@/lib/utils';
import { AgentAvatar } from '@/components/agent/agent-avatar';
import { AGENT_NAME, type AgentState } from '@/components/agent/agent-config';
import { StatusPill } from '@/components/agent/status-pill';
import { NAV_GROUPS, OPEN_PALETTE_EVENT } from './nav-config';

const SIDEBAR_LOGO_HEIGHT = 26;
const DEMO_EMAIL = 'demo@growthos.app';
const DEMO_INITIALS = 'DM';
const INITIALS_LENGTH = 2;
const WORKSPACE_NAME = 'GrowthOS Workspace';

const AGENT_STATUS = {
  online: { state: 'idle', tone: 'success', label: 'Online' },
  checking: { state: 'idle', tone: 'neutral', label: 'Connecting' },
  offline: { state: 'sleeping', tone: 'warning', label: 'Asleep' },
} as const satisfies Record<string, { state: AgentState; tone: 'success' | 'neutral' | 'warning'; label: string }>;

function SidebarBody({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  const router = useRouter();
  const demo = useIsDemo();
  const backend = useBackendStatus();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    if (isDemo()) return;
    createClient().auth.getUser().then(({ data }) => setUser(data.user));
  }, []);

  const signOut = async () => {
    clearApiCache();
    if (isDemo()) {
      exitDemo();
      return;
    }
    await createClient().auth.signOut();
    router.push('/login');
    router.refresh();
  };

  const status = demo ? AGENT_STATUS.online : AGENT_STATUS[backend];
  const email = demo ? DEMO_EMAIL : user?.email;
  const initials = demo ? DEMO_INITIALS : (email?.slice(0, INITIALS_LENGTH).toUpperCase() ?? '?');

  return (
    <div className="flex h-full flex-col bg-ink">
      <div className="flex h-14 shrink-0 items-center px-4">
        <Link href="/dashboard" onClick={onNavigate} aria-label="GrowthOS home">
          <Logo height={SIDEBAR_LOGO_HEIGHT} />
        </Link>
      </div>

      <div className="mx-3 flex items-center gap-3 rounded-xl border border-ink-line bg-ink-panel bg-[radial-gradient(circle_at_20%_0%,rgba(91,79,255,0.25),transparent_60%)] p-3">
        <AgentAvatar state={status.state} size="md" />
        <div className="min-w-0">
          <p className="truncate text-label font-semibold text-white">{AGENT_NAME}</p>
          <StatusPill tone={status.tone} pulse={status.tone === 'success'} className="mt-1">
            {status.label}
          </StatusPill>
        </div>
      </div>

      <button
        type="button"
        onClick={() => window.dispatchEvent(new Event(OPEN_PALETTE_EVENT))}
        className="mx-3 mt-3 flex items-center gap-2 rounded-lg border border-ink-line px-2.5 py-1.5 text-xs text-ink-muted transition-colors hover:bg-white/5 hover:text-white"
      >
        <Search className="size-3.5" aria-hidden />
        <span className="flex-1 text-left">Search or jump to</span>
        <kbd className="font-mono text-2xs">⌘K</kbd>
      </button>

      <nav aria-label="Primary" className="mt-4 flex-1 space-y-4 overflow-y-auto px-3">
        {NAV_GROUPS.map((group) => (
          <div key={group.title}>
            <p className="px-2 pb-1 text-2xs font-medium text-ink-faint">{group.title}</p>
            <ul className="space-y-0.5">
              {group.items.map(({ label, href, icon: Icon }) => {
                const active = pathname.startsWith(href);
                return (
                  <li key={href}>
                    <Link
                      href={href}
                      onClick={onNavigate}
                      aria-current={active ? 'page' : undefined}
                      className={cn(
                        'flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-label font-medium transition-colors',
                        active ? 'bg-primary/20 text-brand-soft' : 'text-ink-muted hover:bg-white/5 hover:text-white',
                      )}
                    >
                      <Icon className="size-4" aria-hidden />
                      {label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {(user || demo) && (
        <div className="flex items-center gap-2.5 border-t border-ink-line p-3">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-2xs font-bold text-white">
            {initials}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium text-white">{email}</p>
            <p className="truncate text-2xs text-ink-faint">{WORKSPACE_NAME}</p>
          </div>
          <button
            type="button"
            onClick={signOut}
            aria-label={demo ? 'Exit demo' : 'Sign out'}
            className="flex size-8 shrink-0 items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-white/5 hover:text-red-400"
          >
            <LogOut className="size-4" aria-hidden />
          </button>
        </div>
      )}
    </div>
  );
}

export function AppSidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <>
      <aside className="hidden w-60 shrink-0 border-r border-ink-line bg-ink lg:block">
        <SidebarBody pathname={pathname} />
      </aside>

      <div className="z-40 flex h-14 shrink-0 items-center justify-between border-b border-ink-line bg-ink px-4 lg:hidden">
        <Link href="/dashboard" aria-label="GrowthOS home">
          <Logo height={SIDEBAR_LOGO_HEIGHT} />
        </Link>
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open navigation"
          aria-expanded={open}
          className="flex size-9 items-center justify-center rounded-lg text-ink-muted hover:bg-white/5"
        >
          <Menu className="size-5" aria-hidden />
        </button>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
          <button type="button" aria-label="Close navigation" className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="relative h-full w-72 max-w-[85%] bg-ink shadow-pop">
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close navigation"
              className="absolute right-3 top-3 z-10 flex size-8 items-center justify-center rounded-lg text-ink-muted hover:bg-white/5"
            >
              <X className="size-4" aria-hidden />
            </button>
            <SidebarBody pathname={pathname} onNavigate={() => setOpen(false)} />
          </div>
        </div>
      )}
    </>
  );
}

'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CornerDownLeft, LogOut, Search } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { clearApiCache } from '@/lib/api';
import { exitDemo, isDemo } from '@/lib/demo/mode';
import { cn } from '@/lib/utils';
import { NAV_GROUPS, OPEN_PALETTE_EVENT } from './nav-config';

type Command = { id: string; label: string; group: string; icon: LucideIcon; keywords?: string; run: () => void };

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const close = () => {
    setOpen(false);
    setQuery('');
    setCursor(0);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener('keydown', onKey);
    window.addEventListener(OPEN_PALETTE_EVENT, onOpen);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener(OPEN_PALETTE_EVENT, onOpen);
    };
  }, []);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const commands = useMemo<Command[]>(() => {
    const go: Command[] = NAV_GROUPS.flatMap((group) =>
      group.items.map((item) => ({
        id: item.href,
        label: `Go to ${item.label}`,
        group: 'Navigate',
        icon: item.icon,
        keywords: item.keywords,
        run: () => router.push(item.href),
      })),
    );
    const leave: Command = {
      id: 'leave',
      label: isDemo() ? 'Exit demo' : 'Sign out',
      group: 'Account',
      icon: LogOut,
      run: async () => {
        clearApiCache();
        if (isDemo()) return exitDemo();
        await createClient().auth.signOut();
        router.push('/login');
        router.refresh();
      },
    };
    return [...go, leave];
  }, [router]);

  const matches = commands.filter((c) => `${c.label} ${c.keywords ?? ''}`.toLowerCase().includes(query.trim().toLowerCase()));

  const choose = (command?: Command) => {
    if (!command) return;
    close();
    command.run();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center bg-ink/50 p-4 pt-[15vh] backdrop-blur-sm" onClick={close}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        className="w-full max-w-lg overflow-hidden rounded-2xl border border-ink-line bg-ink-panel shadow-pop"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === 'Escape') close();
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setCursor((c) => Math.min(c + 1, matches.length - 1));
          }
          if (e.key === 'ArrowUp') {
            e.preventDefault();
            setCursor((c) => Math.max(c - 1, 0));
          }
          if (e.key === 'Enter') choose(matches[cursor]);
        }}
      >
        <div className="flex items-center gap-3 border-b border-ink-line px-4">
          <Search className="size-4 text-ink-muted" aria-hidden />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setCursor(0);
            }}
            placeholder="Jump to a page or run an action"
            aria-label="Search commands"
            className="h-12 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-ink-muted"
          />
          <kbd className="rounded border border-ink-line px-1.5 py-0.5 font-mono text-2xs text-ink-muted">esc</kbd>
        </div>
        <ul className="max-h-72 overflow-y-auto p-2">
          {matches.length === 0 && <li className="px-3 py-6 text-center text-sm text-ink-muted">No matches</li>}
          {matches.map((command, i) => {
            const Icon = command.icon;
            return (
              <li key={command.id}>
                <button
                  type="button"
                  onMouseEnter={() => setCursor(i)}
                  onClick={() => choose(command)}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors',
                    i === cursor ? 'bg-primary/20 text-white' : 'text-ink-muted',
                  )}
                >
                  <Icon className="size-4 text-ink-muted" aria-hidden />
                  <span className="flex-1">{command.label}</span>
                  <span className="text-2xs text-ink-muted">{command.group}</span>
                  {i === cursor && <CornerDownLeft className="size-3.5 text-ink-muted" aria-hidden />}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

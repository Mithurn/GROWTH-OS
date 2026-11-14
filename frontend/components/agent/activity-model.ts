import { useEffect, useRef, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  ACTIVITY_ACTIONS,
  ACTIVITY_DAY_LABELS,
  ACTIVITY_FALLBACK,
  ACTIVITY_KINDS,
  ACTIVITY_TIMING,
  type ActivityFilter,
  type ActivityKind,
  type ActivityMetrics,
} from './activity-config';

export type ActivityEntry = {
  id: string;
  kind: ActivityKind;
  label: string;
  description: string;
  createdAt: string;
  icon: LucideIcon;
  reasoning?: string;
  metrics?: ActivityMetrics;
  live?: boolean;
};

export type RawActivity = {
  id: string;
  actionType: string;
  description: string;
  createdAt: string;
  details?: { reasoning?: unknown; metrics?: unknown } | null;
};

const MS_PER_DAY = 86_400_000;

const humanize = (value: string) => value.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());

function parseMetrics(value: unknown): ActivityMetrics | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const entries = Object.entries(value).filter(([, v]) => typeof v === 'string' || typeof v === 'number');
  return entries.length ? (Object.fromEntries(entries) as ActivityMetrics) : undefined;
}

export function toActivityEntry(raw: RawActivity): ActivityEntry {
  const action = ACTIVITY_ACTIONS[raw.actionType];
  const kind = action?.kind ?? ACTIVITY_FALLBACK.kind;
  const meta = ACTIVITY_KINDS[kind];
  return {
    id: raw.id,
    kind,
    label: action?.label ?? (action ? meta.label : humanize(raw.actionType)),
    description: raw.description,
    createdAt: raw.createdAt,
    icon: action?.icon ?? (action ? meta.icon : ACTIVITY_FALLBACK.icon),
    reasoning: typeof raw.details?.reasoning === 'string' ? raw.details.reasoning : undefined,
    metrics: parseMetrics(raw.details?.metrics),
  };
}

export function filterEntries(entries: readonly ActivityEntry[], filter: ActivityFilter) {
  return filter === 'all' ? entries : entries.filter((e) => ACTIVITY_KINDS[e.kind].group === filter);
}

const dayStart = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

export function groupByDay(entries: readonly ActivityEntry[], now = new Date()) {
  const today = dayStart(now);
  const groups: { label: string; entries: ActivityEntry[] }[] = [];
  for (const entry of entries) {
    const date = new Date(entry.createdAt);
    const diff = Math.round((today - dayStart(date)) / MS_PER_DAY);
    const label =
      diff <= 0
        ? ACTIVITY_DAY_LABELS.today
        : diff === 1
          ? ACTIVITY_DAY_LABELS.yesterday
          : date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    const last = groups[groups.length - 1];
    if (last?.label === label) last.entries.push(entry);
    else groups.push({ label, entries: [entry] });
  }
  return groups;
}

export function isLive(entry: ActivityEntry, isNewest: boolean, busy: boolean) {
  if (!isNewest) return false;
  return entry.live ?? (busy || Date.now() - new Date(entry.createdAt).getTime() < ACTIVITY_TIMING.liveWindowMs);
}

export function useFreshIds(entries: readonly ActivityEntry[], ready: boolean) {
  const seen = useRef<Set<string> | null>(null);
  const [fresh, setFresh] = useState<ReadonlySet<string>>(new Set());

  useEffect(() => {
    const known = seen.current;
    if (!ready) return;
    if (!known) {
      seen.current = new Set(entries.map((e) => e.id));
      return;
    }
    const added = entries.filter((e) => !known.has(e.id)).map((e) => e.id);
    if (!added.length) return;
    added.forEach((id) => known.add(id));
    setFresh((prev) => new Set([...prev, ...added]));
  }, [entries, ready]);

  return fresh;
}

export function useRotatingText(phrases: readonly string[], intervalMs: number, paused: boolean) {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % phrases.length), intervalMs);
    return () => clearInterval(id);
  }, [phrases.length, intervalMs, paused]);
  return phrases[index];
}

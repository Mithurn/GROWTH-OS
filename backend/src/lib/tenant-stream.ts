import type { Response } from 'express';
import { EventEmitter } from 'events';
import { createSubscriber, getClient } from './redis';

const RING = 200;
const HEARTBEAT_MS = 25_000;
const BLOCK_MS = 15_000;

export interface TenantStreamEvent {
  id: string;
  companyId: string;
  actionType: string;
  payload: Record<string, unknown>;
  createdAt: string;
}

type Filter = (event: TenantStreamEvent) => boolean;

const memory = new Map<string, TenantStreamEvent[]>();
const local = new EventEmitter();
local.setMaxListeners(100);
let memSeq = 0;

export function streamKey(companyId: string): string {
  return `stream:activity:${companyId}`;
}

function remember(event: TenantStreamEvent): void {
  const ring = memory.get(event.companyId) ?? [];
  ring.push(event);
  if (ring.length > RING) ring.splice(0, ring.length - RING);
  memory.set(event.companyId, ring);
}

function replay(companyId: string, lastEventId: string | undefined, filter?: Filter): TenantStreamEvent[] {
  const ring = memory.get(companyId) ?? [];
  if (!lastEventId) return ring.filter((e) => (filter ? filter(e) : true));
  const idx = ring.findIndex((e) => e.id === lastEventId);
  const after = idx === -1 ? ring : ring.slice(idx + 1);
  return after.filter((e) => (filter ? filter(e) : true));
}

/**
 * Append one tenant-scoped event. Prefers Redis Streams (`XADD`) so a reconnect
 * can replay via Last-Event-ID. Falls back to an in-process ring + EventEmitter
 * when Redis is unset — local/dev only, lost on process exit.
 */
export async function appendTenantEvent(
  companyId: string,
  actionType: string,
  payload: Record<string, unknown>,
): Promise<TenantStreamEvent> {
  const createdAt = new Date().toISOString();
  const redis = getClient();

  if (redis) {
    try {
      const id = await redis.xadd(
        streamKey(companyId),
        'MAXLEN',
        '~',
        '500',
        '*',
        'actionType',
        actionType,
        'payload',
        JSON.stringify(payload),
        'createdAt',
        createdAt,
      );
      const event: TenantStreamEvent = {
        id: id ?? `${Date.now()}-${++memSeq}`,
        companyId,
        actionType,
        payload,
        createdAt,
      };
      remember(event);
      local.emit(companyId, event);
      return event;
    } catch {
      // fall through to memory
    }
  }

  const event: TenantStreamEvent = {
    id: `${Date.now()}-${++memSeq}`,
    companyId,
    actionType,
    payload,
    createdAt,
  };
  remember(event);
  local.emit(companyId, event);
  return event;
}

function writeSse(res: Response, event: TenantStreamEvent): void {
  res.write(`id: ${event.id}\n`);
  res.write(`event: ${event.actionType}\n`);
  res.write(`data: ${JSON.stringify(event)}\n\n`);
}

export interface SubscribeOptions {
  lastEventId?: string;
  filter?: Filter;
}

/**
 * Tenant-keyed SSE. Replays from Last-Event-ID (memory ring, plus XRANGE when
 * Redis is up), then tails. One blocking Redis read per connection — fine at
 * this volume; fan-in to one reader per process is the follow-up if Upstash
 * command cost becomes real.
 */
export async function subscribeTenantStream(
  res: Response,
  companyId: string,
  options: SubscribeOptions = {},
): Promise<() => void> {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  for (const event of replay(companyId, options.lastEventId, options.filter)) {
    writeSse(res, event);
  }

  const heartbeat = setInterval(() => {
    res.write(': heartbeat\n\n');
  }, HEARTBEAT_MS);

  const onLocal = (event: TenantStreamEvent) => {
    if (event.companyId !== companyId) return;
    if (options.filter && !options.filter(event)) return;
    writeSse(res, event);
  };
  local.on(companyId, onLocal);

  let stopped = false;
  let reader: ReturnType<typeof createSubscriber> = null;
  let loop: Promise<void> | undefined;

  const redis = getClient();
  if (redis) {
    reader = createSubscriber();
    if (reader) {
      let cursor = options.lastEventId && options.lastEventId.includes('-') ? options.lastEventId : '$';
      loop = (async () => {
        while (!stopped) {
          try {
            const rows = await reader.xread(
              'BLOCK',
              BLOCK_MS,
              'STREAMS',
              streamKey(companyId),
              cursor,
            );
            if (!rows) continue;
            for (const [, entries] of rows) {
              for (const [id, fields] of entries) {
                cursor = id;
                const map = fieldMap(fields);
                const event: TenantStreamEvent = {
                  id,
                  companyId,
                  actionType: map.actionType ?? 'event',
                  payload: safeJson(map.payload),
                  createdAt: map.createdAt ?? new Date().toISOString(),
                };
                if (options.filter && !options.filter(event)) continue;
                writeSse(res, event);
              }
            }
          } catch {
            if (!stopped) await new Promise((r) => setTimeout(r, 1000));
          }
        }
      })();
    }
  }

  return () => {
    stopped = true;
    clearInterval(heartbeat);
    local.off(companyId, onLocal);
    reader?.disconnect();
    void loop;
  };
}

function fieldMap(fields: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 0; i + 1 < fields.length; i += 2) {
    out[fields[i]] = fields[i + 1];
  }
  return out;
}

function safeJson(raw: string | undefined): Record<string, unknown> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : { value: parsed };
  } catch {
    return {};
  }
}

/** Test-only: wipe the in-process ring. */
export function resetTenantStreamForTests(): void {
  memory.clear();
  memSeq = 0;
}

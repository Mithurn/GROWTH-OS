import type { Response } from 'express';
import { createSubscriber, getClient } from './redis';

const HEARTBEAT_MS = 25_000;
const BLOCK_MS = 15_000;
const MAX_LEN = '500';

export interface TenantStreamEvent {
  id: string;
  companyId: string;
  actionType: string;
  payload: Record<string, unknown>;
  createdAt: string;
}

type Filter = (event: TenantStreamEvent) => boolean;

export function streamKey(companyId: string): string {
  return `stream:activity:${companyId}`;
}

/** Append one tenant-scoped event to its Redis Stream so reconnects replay via Last-Event-ID. */
export async function appendTenantEvent(
  companyId: string,
  actionType: string,
  payload: Record<string, unknown>,
): Promise<TenantStreamEvent | null> {
  const createdAt = new Date().toISOString();
  try {
    const id = await getClient().xadd(
      streamKey(companyId),
      'MAXLEN',
      '~',
      MAX_LEN,
      '*',
      'actionType',
      actionType,
      'payload',
      JSON.stringify(payload),
      'createdAt',
      createdAt,
    );
    return id ? { id, companyId, actionType, payload, createdAt } : null;
  } catch (err) {
    console.warn('[tenant-stream] append failed', (err as Error).message);
    return null;
  }
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

/** Tenant-keyed SSE: resumes after Last-Event-ID, otherwise tails new events. One blocking reader per connection. */
export async function subscribeTenantStream(
  res: Response,
  companyId: string,
  options: SubscribeOptions = {},
): Promise<() => void> {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const heartbeat = setInterval(() => {
    res.write(': heartbeat\n\n');
  }, HEARTBEAT_MS);

  let stopped = false;
  const reader = createSubscriber();
  let cursor = options.lastEventId && options.lastEventId.includes('-') ? options.lastEventId : '$';
  const loop = (async () => {
    while (!stopped) {
      try {
        const rows = await reader.xread('BLOCK', BLOCK_MS, 'STREAMS', streamKey(companyId), cursor);
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

  return () => {
    stopped = true;
    clearInterval(heartbeat);
    reader.disconnect();
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

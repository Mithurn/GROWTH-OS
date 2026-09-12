import { EventEmitter } from 'events';
import type { Response } from 'express';
import { getClient, createSubscriber } from './redis';

const CHANNEL = 'activity';
const emitter = new EventEmitter();
emitter.setMaxListeners(100);

export interface ActivityEvent {
  id: string;
  companyId: string;
  agentId: string;
  actionType: string;
  description: string;
  details?: Record<string, unknown>;
  createdAt: Date | string;
}

/**
 * Publish an agent activity event.
 *
 * When Redis is configured the event is published on a channel, so a subscriber
 * connected to any instance (or reconnecting after a spin-down) still receives it.
 * Without Redis it stays on the in-process emitter — the local/dev fallback.
 */
export function emitActivity(action: ActivityEvent): void {
  const redis = getClient();
  if (redis) {
    redis.publish(CHANNEL, JSON.stringify(action)).catch(() => {
      emitter.emit('activity', action);
    });
    return;
  }
  emitter.emit('activity', action);
}

export async function subscribeToActivity(res: Response, companyId: string): Promise<() => void> {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const send = (action: ActivityEvent) => {
    if (action.companyId !== companyId) return;
    const { companyId: _omit, ...payload } = action;
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
  };

  const heartbeat = setInterval(() => {
    res.write(': heartbeat\n\n');
  }, 25000);

  const subscriber = createSubscriber();
  if (subscriber) {
    const onMessage = (_channel: string, message: string) => {
      try {
        send(JSON.parse(message) as ActivityEvent);
      } catch {
        // ignore malformed payloads
      }
    };
    try {
      await subscriber.subscribe(CHANNEL);
      subscriber.on('message', onMessage);
    } catch {
      subscriber.disconnect();
      emitter.on('activity', send);
      return () => {
        clearInterval(heartbeat);
        emitter.off('activity', send);
      };
    }

    return () => {
      clearInterval(heartbeat);
      subscriber.off('message', onMessage);
      subscriber.disconnect();
    };
  }

  emitter.on('activity', send);
  return () => {
    clearInterval(heartbeat);
    emitter.off('activity', send);
  };
}

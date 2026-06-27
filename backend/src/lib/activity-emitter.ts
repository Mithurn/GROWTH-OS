import { EventEmitter } from 'events';
import type { Response } from 'express';

const emitter = new EventEmitter();
emitter.setMaxListeners(100);

export function emitActivity(action: {
  id: string;
  agentId: string;
  actionType: string;
  description: string;
  details?: Record<string, unknown>;
  createdAt: Date | string;
}): void {
  emitter.emit('activity', action);
}

export function subscribeToActivity(res: Response, companyId: string): () => void {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const send = (action: Record<string, unknown>) => {
    res.write(`data: ${JSON.stringify(action)}\n\n`);
  };

  // Heartbeat every 25s to keep connection alive through proxies
  const heartbeat = setInterval(() => {
    res.write(': heartbeat\n\n');
  }, 25000);

  emitter.on('activity', send);

  return () => {
    clearInterval(heartbeat);
    emitter.off('activity', send);
  };
}

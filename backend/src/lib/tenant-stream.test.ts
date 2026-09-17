import { describe, it, expect, beforeEach } from 'vitest';
import { EventEmitter } from 'events';
import {
  appendTenantEvent,
  resetTenantStreamForTests,
  streamKey,
  subscribeTenantStream,
} from './tenant-stream';

class FakeRes extends EventEmitter {
  headers: Record<string, string> = {};
  chunks: string[] = [];
  setHeader(name: string, value: string) {
    this.headers[name] = value;
  }
  flushHeaders() {}
  write(chunk: string) {
    this.chunks.push(chunk);
    return true;
  }
}

beforeEach(() => {
  resetTenantStreamForTests();
});

describe('tenant-stream', () => {
  it('keys the Redis stream on companyId, not a shared channel', () => {
    expect(streamKey('co_a')).toBe('stream:activity:co_a');
    expect(streamKey('co_a')).not.toBe(streamKey('co_b'));
  });

  it('replays only events after Last-Event-ID for that tenant', async () => {
    const first = await appendTenantEvent('co_a', 'agent_step', { n: 1 });
    await appendTenantEvent('co_a', 'agent_step', { n: 2 });
    await appendTenantEvent('co_b', 'agent_step', { n: 99 });

    const res = new FakeRes() as unknown as import('express').Response;
    const stop = await subscribeTenantStream(res, 'co_a', { lastEventId: first.id });
    stop();

    const body = (res as unknown as FakeRes).chunks.join('');
    expect(body).toMatch(/"n":2/);
    expect(body).not.toMatch(/"n":1/);
    expect(body).not.toMatch(/"n":99/);
  });

  it('does not leak another tenant through the filter', async () => {
    await appendTenantEvent('co_other', 'campaign_delivery', { campaignId: 'camp_x' });
    const res = new FakeRes() as unknown as import('express').Response;
    const stop = await subscribeTenantStream(res, 'co_real', {
      filter: (e) => e.actionType === 'campaign_delivery',
    });
    stop();
    const body = (res as unknown as FakeRes).chunks.join('');
    expect(body).not.toMatch(/camp_x/);
  });
});

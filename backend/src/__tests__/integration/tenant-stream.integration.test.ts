import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { EventEmitter } from 'events';
import type { Response } from 'express';
import { GenericContainer, type StartedTestContainer } from 'testcontainers';

class FakeRes extends EventEmitter {
  chunks: string[] = [];
  setHeader() {}
  flushHeaders() {}
  write(chunk: string) {
    this.chunks.push(chunk);
    return true;
  }
  body() {
    return this.chunks.join('');
  }
}

let container: StartedTestContainer;
let stream: typeof import('../../lib/tenant-stream');
let redis: typeof import('../../lib/redis');

const waitFor = async (check: () => boolean, ms = 5000) => {
  const end = Date.now() + ms;
  while (!check() && Date.now() < end) await new Promise((r) => setTimeout(r, 50));
};

describe('tenant stream on real Redis', () => {
  beforeAll(async () => {
    container = await new GenericContainer('redis:7-alpine').withExposedPorts(6379).start();
    process.env.REDIS_URL = `redis://${container.getHost()}:${container.getMappedPort(6379)}`;
    redis = await import('../../lib/redis');
    stream = await import('../../lib/tenant-stream');
    await redis.assertRedisReachable();
  }, 60_000);

  afterAll(async () => {
    redis?.getClient().disconnect();
    await container?.stop();
  });

  it('delivers a live event exactly once, only to its own tenant', async () => {
    const a = new FakeRes();
    const b = new FakeRes();
    const stopA = await stream.subscribeTenantStream(a as unknown as Response, 'co_a');
    const stopB = await stream.subscribeTenantStream(b as unknown as Response, 'co_b');
    await new Promise((r) => setTimeout(r, 300));

    await stream.appendTenantEvent('co_a', 'agent_step', { n: 1 });
    await waitFor(() => a.body().includes('"n":1'));
    await new Promise((r) => setTimeout(r, 300));
    stopA();
    stopB();

    expect(a.body().match(/"n":1/g)).toHaveLength(1);
    expect(b.body()).not.toMatch(/"n":1/);
  });

  it('replays only what came after Last-Event-ID', async () => {
    const first = await stream.appendTenantEvent('co_replay', 'agent_step', { n: 'first' });
    await stream.appendTenantEvent('co_replay', 'agent_step', { n: 'second' });
    expect(first).not.toBeNull();

    const res = new FakeRes();
    const stop = await stream.subscribeTenantStream(res as unknown as Response, 'co_replay', {
      lastEventId: first!.id,
    });
    await waitFor(() => res.body().includes('second'));
    stop();

    expect(res.body()).toMatch(/"n":"second"/);
    expect(res.body()).not.toMatch(/"n":"first"/);
  });

  it('applies the subscriber filter', async () => {
    const res = new FakeRes();
    const stop = await stream.subscribeTenantStream(res as unknown as Response, 'co_filter', {
      filter: (e) => e.actionType === 'campaign_delivery',
    });
    await new Promise((r) => setTimeout(r, 300));
    await stream.appendTenantEvent('co_filter', 'agent_step', { skip: true });
    await stream.appendTenantEvent('co_filter', 'campaign_delivery', { keep: true });
    await waitFor(() => res.body().includes('keep'));
    stop();

    expect(res.body()).toMatch(/"keep":true/);
    expect(res.body()).not.toMatch(/"skip":true/);
  });
});

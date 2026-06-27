import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

// vi.hoisted runs before vi.mock factories, so mockGetUser is defined before the factory runs
const { mockGetUser } = vi.hoisted(() => ({ mockGetUser: vi.fn() }));

const supabaseQueryResult = { data: [], error: null, count: 0 };

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => {
    // A proper thenable chain — .then(resolve, reject) must CALL resolve to unblock await
    const makeChain = (): Record<string, unknown> => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      neq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      range: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      upsert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: { company_id: 'co_test' }, error: null }),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
      // Proper thenable: call resolve() so await resolves
      then: vi.fn((resolve: (v: unknown) => void) => resolve(supabaseQueryResult)),
      catch: vi.fn().mockReturnThis(),
    });
    return {
      auth: { getUser: mockGetUser },
      from: vi.fn(() => makeChain()),
    };
  }),
}));

import { app } from '../server';

describe('GET /health', () => {
  it('returns 200 with status ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'ok' });
  });
});

describe('Auth guard', () => {
  beforeEach(() => {
    mockGetUser.mockReset();
  });

  it('returns 401 on protected endpoints when no Authorization header is sent', async () => {
    const endpoints = [
      ['GET', '/api/campaigns'],
      ['GET', '/api/agents'],
      ['GET', '/api/activity-stream'],
    ] as const;

    for (const [method, path] of endpoints) {
      const res = await (request(app) as any)[method.toLowerCase()](path);
      expect(res.status, `${method} ${path} should return 401`).toBe(401);
      expect(res.body.error).toBe('Unauthorized');
    }
  });

  it('returns 401 when token is invalid', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: { message: 'Invalid token' } });

    const res = await request(app)
      .get('/api/campaigns')
      .set('Authorization', 'Bearer invalid-token');

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Invalid or expired token');
  });
});

describe('Body validation', () => {
  beforeEach(() => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user_test' } }, error: null });
  });

  it('POST /api/campaigns rejects missing opportunityId with 400', async () => {
    const res = await request(app)
      .post('/api/campaigns')
      .set('Authorization', 'Bearer valid-token')
      .send({ campaign: { name: 'test' } });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation failed');
    expect(res.body.issues.some((i: { field: string }) => i.field === 'opportunityId')).toBe(true);
  });

  it('POST /api/campaigns rejects missing campaign with 400', async () => {
    const res = await request(app)
      .post('/api/campaigns')
      .set('Authorization', 'Bearer valid-token')
      .send({ opportunityId: 'opp_1' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation failed');
    expect(res.body.issues.some((i: { field: string }) => i.field === 'campaign')).toBe(true);
  });

  it('POST /api/agents rejects missing goal with 400', async () => {
    const res = await request(app)
      .post('/api/agents')
      .set('Authorization', 'Bearer valid-token')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation failed');
    expect(res.body.issues.some((i: { field: string }) => i.field === 'goal')).toBe(true);
  });

  it('POST /api/campaigns/generate rejects missing opportunityId with 400', async () => {
    const res = await request(app)
      .post('/api/campaigns/generate')
      .set('Authorization', 'Bearer valid-token')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation failed');
    expect(res.body.issues.some((i: { field: string }) => i.field === 'opportunityId')).toBe(true);
  });

  it('PATCH /api/agents/:id rejects empty body with 400', async () => {
    const res = await request(app)
      .patch('/api/agents/agent_1')
      .set('Authorization', 'Bearer valid-token')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation failed');
  });

  it('POST /api/opportunities/create-from-goal rejects empty goal with 400', async () => {
    const res = await request(app)
      .post('/api/opportunities/create-from-goal')
      .set('Authorization', 'Bearer valid-token')
      .send({ goal: '' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation failed');
    expect(res.body.issues.some((i: { field: string }) => i.field === 'goal')).toBe(true);
  });
});

describe('Pagination', () => {
  beforeEach(() => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user_test' } }, error: null });
  });

  it('GET /api/agents returns meta with pagination fields', async () => {
    const res = await request(app)
      .get('/api/agents')
      .set('Authorization', 'Bearer valid-token');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('meta');
    expect(res.body.meta).toMatchObject({
      page: 1,
      limit: 20,
      total: 0,
      pages: 0,
    });
  });

  it('GET /api/agents respects ?page and ?limit query params', async () => {
    const res = await request(app)
      .get('/api/agents?page=2&limit=5')
      .set('Authorization', 'Bearer valid-token');

    expect(res.status).toBe(200);
    expect(res.body.meta).toMatchObject({ page: 2, limit: 5 });
  });

  it('GET /api/agents clamps limit to 100 max', async () => {
    const res = await request(app)
      .get('/api/agents?limit=999')
      .set('Authorization', 'Bearer valid-token');

    expect(res.status).toBe(200);
    expect(res.body.meta.limit).toBe(100);
  });
});

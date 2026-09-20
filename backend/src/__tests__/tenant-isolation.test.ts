import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

const { mockGetUser, resourceCompanyId } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  resourceCompanyId: { value: 'co_caller' },
}));

const CALLER_COMPANY = 'co_caller';
const OTHER_COMPANY = 'co_someone_else';

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => {
    const makeChain = (table: string): Record<string, unknown> => ({
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
      maybeSingle: vi.fn().mockImplementation(async () => {
        // `profiles` resolves which company the caller belongs to; every other table
        // stands in for the resource being addressed by id.
        if (table === 'profiles') {
          return { data: { company_id: CALLER_COMPANY }, error: null };
        }
        return { data: { company_id: resourceCompanyId.value }, error: null };
      }),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
      then: vi.fn((resolve: (v: unknown) => void) =>
        resolve({ data: [], error: null, count: 0 }),
      ),
      catch: vi.fn().mockReturnThis(),
    });

    return {
      auth: { getUser: mockGetUser },
      from: vi.fn((table: string) => makeChain(table)),
    };
  }),
}));

// requireAuth verifies locally now (lib/verify-jwt.ts), not via
// supabase.auth.getUser — reuses the same mockGetUser so every existing
// `mockGetUser.mockResolvedValue(...)` call in this file still drives it.
vi.mock('../lib/verify-jwt', () => ({
  verifySupabaseToken: vi.fn(async (token: string) => {
    const { data, error } = await mockGetUser(token);
    if (error || !data?.user) return null;
    return { id: data.user.id, email: data.user.email };
  }),
}));

import { app } from '../server';
import { prisma } from '../lib/prisma';

// Routes that take a resource id and must be scoped to the caller's company.
const SCOPED_ROUTES = [
  ['get', '/api/campaigns/camp_1'],
  ['get', '/api/campaigns/camp_1/analytics'],
  ['post', '/api/campaigns/camp_1/approve'],
  ['post', '/api/campaigns/camp_1/launch'],
  ['get', '/api/opportunities/opp_1'],
  ['get', '/api/agents/agent_1'],
  ['get', '/api/agents/agent_1/runs'],
  ['get', '/api/agents/agent_1/runs/run_1'],
  ['post', '/api/agents/agent_1/run'],
  ['get', '/api/ingestion-status/sess_1'],
] as const;

describe('Cross-tenant access', () => {
  beforeEach(() => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user_caller' } }, error: null });
    vi.mocked(prisma.profile.findUnique).mockResolvedValue({ companyId: CALLER_COMPANY } as never);
    const ownedRow = async () => ({ companyId: resourceCompanyId.value });
    vi.mocked(prisma.campaign.findUnique).mockImplementation(ownedRow as never);
    vi.mocked(prisma.agent.findUnique).mockImplementation(ownedRow as never);
    vi.mocked(prisma.ingestionSession.findUnique).mockImplementation(ownedRow as never);
    vi.mocked(prisma.opportunity.findUnique).mockImplementation(ownedRow as never);
  });

  it('returns 404 for every id-addressed route when the row belongs to another company', async () => {
    resourceCompanyId.value = OTHER_COMPANY;

    for (const [method, path] of SCOPED_ROUTES) {
      const res = await (request(app) as any)[method](path)
        .set('Authorization', 'Bearer valid-token');

      expect(res.status, `${method.toUpperCase()} ${path} should deny access`).toBe(404);
      expect(res.body.error).toBe('Not found');
    }
  });

  it('lets the request reach the handler when the row belongs to the caller', async () => {
    resourceCompanyId.value = CALLER_COMPANY;

    for (const [method, path] of SCOPED_ROUTES) {
      const res = await (request(app) as any)[method](path)
        .set('Authorization', 'Bearer valid-token');

      // Handlers can still fail against mocked data — some legitimately 404 with their
      // own message. The guard's rejection is the bare `Not found`, so its absence is
      // what proves the request got past the guard.
      expect(res.body.error, `${method.toUpperCase()} ${path} should pass the guard`).not.toBe(
        'Not found',
      );
    }
  });

  it('still requires authentication on id-addressed routes', async () => {
    resourceCompanyId.value = CALLER_COMPANY;

    for (const [method, path] of SCOPED_ROUTES) {
      const res = await (request(app) as any)[method](path);
      expect(res.status, `${method.toUpperCase()} ${path} should require auth`).toBe(401);
    }
  });
});

describe('SSE event routes', () => {
  it('require authentication and do not start a stream without a JWT', async () => {
    for (const path of ['/api/campaigns/camp_1/events', '/api/agents/agent_1/runs/run_1/events']) {
      const res = await request(app).get(path);
      expect(res.status, path).toBe(401);
    }
  });

  it('return 404 when the campaign belongs to another company', async () => {
    resourceCompanyId.value = OTHER_COMPANY;
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user_caller' } }, error: null });
    vi.mocked(prisma.profile.findUnique).mockResolvedValue({ companyId: CALLER_COMPANY } as never);
    vi.mocked(prisma.campaign.findUnique).mockResolvedValue({ companyId: OTHER_COMPANY } as never);
    const res = await request(app)
      .get('/api/campaigns/camp_1/events')
      .set('Authorization', 'Bearer valid-token');
    expect(res.status).toBe(404);
  });
});

describe('GET /api/internal/agent/tools', () => {
  const path = '/api/internal/agent/tools';

  it('rejects a request with no secret', async () => {
    const res = await request(app).get(path);
    expect(res.status).toBe(401);
  });

  it('returns the bound shadow catalog when the secret is present', async () => {
    const res = await request(app).get(path).set('x-internal-secret', 'test-internal-secret');
    expect(res.status).toBe(200);
    expect(res.body.mode).toBe('shadow');
    const names = (res.body.tools as Array<{ name: string }>).map((t) => t.name);
    expect(names).toContain('growthos_query_metrics');
    expect(names).not.toContain('growthos_create_opportunity');
  });
});

describe('GET /api/internal/agent/tools', () => {
  const path = '/api/internal/agent/tools';

  it('rejects a request with no secret', async () => {
    const res = await request(app).get(path);
    expect(res.status).toBe(401);
  });

  it('lists the bound shadow catalog when the secret is present', async () => {
    const res = await request(app)
      .get(path)
      .set('x-internal-secret', 'test-internal-secret');

    expect(res.status).toBe(200);
    expect(res.body.mode).toBe('shadow');
    const names = (res.body.tools as Array<{ name: string }>).map((t) => t.name);
    expect(names).toContain('growthos_query_metrics');
    expect(names).toContain('growthos_finish');
    expect(names).not.toContain('growthos_create_opportunity');
  });
});

describe('POST /api/internal/agents/run-scheduled', () => {
  const path = '/api/internal/agents/run-scheduled';

  it('rejects a request with no secret', async () => {
    const res = await request(app).post(path);
    expect(res.status).toBe(401);
  });

  it('rejects a wrong secret', async () => {
    const res = await request(app).post(path).set('x-internal-secret', 'not-the-secret');
    expect(res.status).toBe(401);
  });

  // Regression guard: a length mismatch must not reach timingSafeEqual, which throws.
  it('rejects a short secret without erroring', async () => {
    const res = await request(app).post(path).set('x-internal-secret', 'x');
    expect(res.status).toBe(401);
  });

  it('accepts the configured secret', async () => {
    const res = await request(app)
      .post(path)
      .set('x-internal-secret', 'test-internal-secret');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('does not accept a Supabase user token in place of the secret', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user_caller' } }, error: null });

    const res = await request(app).post(path).set('Authorization', 'Bearer valid-token');
    expect(res.status).toBe(401);
  });
});

describe('Upload routes', () => {
  beforeEach(() => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user_caller' } }, error: null });
  });

  it('require authentication', async () => {
    for (const path of ['/api/upload/customers', '/api/upload/orders']) {
      const res = await request(app).post(path);
      expect(res.status, `${path} should require auth`).toBe(401);
    }
  });

  it('reject non-CSV uploads with 400', async () => {
    const res = await request(app)
      .post('/api/upload/customers')
      .set('Authorization', 'Bearer valid-token')
      .attach('file', Buffer.from('not a csv'), {
        filename: 'payload.exe',
        contentType: 'application/x-msdownload',
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Only CSV files are accepted');
  });
});

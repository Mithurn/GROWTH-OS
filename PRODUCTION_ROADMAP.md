# Xeno Growth OS — Production Roadmap

**Goal:** Turn this from a demo CRM into a standalone, production-grade, multi-tenant SaaS CRM that real users can sign up for. Resume/portfolio target.

**Stack:**
- Frontend: Next.js 16, React 19, Tailwind v4, shadcn — deployed on Vercel
- Backend: Express 5, TypeScript 6, Prisma 7, Supabase (PostgreSQL) — deployed on Render
- Channel Service: Express 5 — deployed on Render (currently a delivery simulator)
- Auth: Supabase Auth (JWT-based)
- AI: OpenRouter (free tier), `openai` npm package pointed at OpenRouter baseURL
- Queue: bullmq + ioredis (installed, partially used)
- Logging: pino + pino-http (installed, barely used — 53+ console.log calls instead)
- Validation: zod (installed, barely used)

**Backend entry point:** `backend/src/server.ts`
**Auth middleware:** `backend/src/middleware/auth.ts` — `softAuth` (optional) and `requireAuth` (enforces JWT)
**Company resolution:** `resolveCompany()` function in `server.ts` lines ~85-100 — currently falls back to client-provided `companyId` which is a security hole
**Prisma schema:** `backend/prisma/schema.prisma`
**Channel service:** `channel-service/server.ts` + `queue.ts` + `webhook.ts`
**Frontend API client:** `frontend/lib/api.ts` — 80+ fetch wrappers, all send Bearer token

---

## CRITICAL CONTEXT FOR AI AGENT PICKING THIS UP

### The Core Security Problem (fix first)
Most backend routes use `softAuth` middleware (auth is optional). `resolveCompany()` tries to look up the company from the authenticated user but **falls back to a `companyId` passed by the client** in the request body or query string. This means any authenticated user can access any company's data by passing a different `companyId`. Fix: always resolve `companyId` from the authenticated user's DB profile — never from the request.

### Schema Divergence
The Prisma schema (`backend/prisma/schema.prisma`) does NOT match the actual Supabase DB. The DB has columns that Prisma doesn't know about:
- `companies.user_id` — owner's Supabase auth UID (the DB has it, schema doesn't declare it)
- `customers.company_id` — multi-tenant scoping column
- `products.company_id` — multi-tenant scoping column

The code uses Supabase client (not Prisma) for most read/write operations, so this has worked but it's fragile. When adding the `profiles` table or any migration, use Supabase SQL directly and update the Prisma schema to match.

### How Auth Currently Works
1. Frontend gets Supabase JWT from `supabase.auth.getSession()`
2. Sends it as `Authorization: Bearer <token>` on all API calls
3. Backend `softAuth` calls `supabase.auth.getUser(token)` → gets `userId`
4. `resolveCompany(userId, fallbackCompanyId)` → queries `companies` table for `user_id = userId`
5. If not found, uses `fallbackCompanyId` from request — **THIS IS THE BUG**

### The Demo Mode
Onboarding has a "use demo data" shortcut that hardcodes `company_id = '1bac1f55-82ad-4d34-a5e2-42ec8d7794da'`. After real auth + RLS are in place, demo mode should create a real company record for the user and seed demo data for it, instead of pointing everyone at the same shared company.

---

## PHASE 1 — Auth + Multi-tenancy + RLS
**Status: TODO**
**Priority: HIGHEST — nothing else matters if data isolation is broken**

### 1A: Add `profiles` table + formalize schema

**What to do:**
1. Add `profiles` model to `backend/prisma/schema.prisma`:
```prisma
model Profile {
  id        String   @id @default(uuid()) // = auth.uid() from Supabase
  companyId String   @map("company_id")
  role      String   @default("owner")   // 'owner' | 'member'
  createdAt DateTime @default(now()) @map("created_at")

  company   Company  @relation(fields: [companyId], references: [id], onDelete: Cascade)

  @@map("profiles")
}
```

2. Add missing columns to existing models:
```prisma
// In Company model, add:
userId  String?  @unique @map("user_id")  // Supabase auth UID of the owner

// In Customer model, add:
companyId String @map("company_id")
company   Company @relation(fields: [companyId], references: [id], onDelete: Cascade)

// In Product model, add:
companyId String @map("company_id")
company   Company @relation(fields: [companyId], references: [id], onDelete: Cascade)
```

3. Run migration: `npx prisma migrate dev --name add-profiles-and-company-fks`

4. Create the `profiles` table in Supabase via SQL (in case Prisma migration doesn't handle it):
```sql
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY,  -- = auth.uid()
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'owner',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_profiles_company_id ON profiles(company_id);
```

5. Backfill existing `companies` that have `user_id`: insert into `profiles` for any existing user_id on companies table.

**Files to change:**
- `backend/prisma/schema.prisma` — add Profile model + missing columns
- `backend/src/server.ts` — update `resolveCompany()` to use profiles table

---

### 1B: Fix auth model — requireAuth everywhere + companyId from profile only

**What to do:**

1. Rewrite `resolveCompany()` in `backend/src/server.ts`:
```typescript
// OLD (insecure — falls back to client-provided companyId):
async function resolveCompany(userId?: string, fallbackCompanyId?: string): Promise<string | null> {
  if (userId) {
    const { data } = await supabase.from('companies').select('id').eq('user_id', userId).maybeSingle();
    if (data?.id) return data.id;
  }
  return fallbackCompanyId ?? null;
}

// NEW (secure — only from profiles table):
async function resolveCompany(userId: string): Promise<string | null> {
  const { data } = await supabase
    .from('profiles')
    .select('company_id')
    .eq('id', userId)
    .maybeSingle();
  return data?.company_id ?? null;
}
```

2. On the `AuthRequest` type, add `companyId?: string` so middleware can attach it:
```typescript
export interface AuthRequest extends Request {
  userId?: string;
  companyId?: string;
}
```

3. Create a `resolveCompanyMiddleware` that runs after `requireAuth` and attaches `req.companyId`:
```typescript
export async function resolveCompanyMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const companyId = await resolveCompany(req.userId!);
  if (!companyId) return res.status(403).json({ error: 'No company found for this user. Complete onboarding first.' });
  req.companyId = companyId;
  next();
}
```

4. Change every data route from `softAuth` to `requireAuth`. Routes that need company context also get `resolveCompanyMiddleware`. Example:
```typescript
// BEFORE:
app.get('/api/opportunities', softAuth, async (req: AuthRequest, res) => {
  const fallback = typeof req.query.companyId === 'string' ? req.query.companyId : undefined;
  const companyId = await resolveCompany(req.userId, fallback) ?? fallback;

// AFTER:
app.get('/api/opportunities', requireAuth, resolveCompanyMiddleware, async (req: AuthRequest, res) => {
  const companyId = req.companyId!;
```

5. Remove all instances of `req.body.companyId`, `req.query.companyId` being used for data access. These are the specific routes to audit:
   - `/api/onboarding/business` (softAuth → requireAuth, create profile here after creating company)
   - `/api/onboarding/complete` (softAuth → requireAuth)
   - `/api/process-ingestion` (softAuth → requireAuth + resolveCompanyMiddleware)
   - `/api/ingestion-status/:id` (add requireAuth)
   - `/api/opportunities` (softAuth → requireAuth + resolveCompanyMiddleware)
   - `/api/opportunities/generate` (softAuth → requireAuth)
   - `/api/opportunities/:id` (softAuth → requireAuth)
   - `/api/opportunities/:id/refine` (softAuth → requireAuth)
   - `/api/personas/generate` (softAuth → requireAuth)
   - `/api/personas` (softAuth → requireAuth)
   - `/api/campaigns/generate` (softAuth → requireAuth)
   - `/api/campaigns` (softAuth → requireAuth)
   - `/api/campaigns/:id` (softAuth → requireAuth)
   - `/api/analytics/*` all routes (softAuth → requireAuth)
   - `/api/agents` (softAuth → requireAuth)
   - `/api/activity-stream` (add requireAuth)
   - `/api/sse/activity` (add requireAuth, get companyId from profile not query)

6. In `/api/onboarding/business` (the company creation endpoint), after creating the company, also insert into `profiles`:
```typescript
// After creating company:
await supabase.from('profiles').insert({
  id: req.userId,     // = auth.uid()
  company_id: company.id,
  role: 'owner'
});
```

**Files to change:**
- `backend/src/server.ts` — all route middleware, resolveCompany function
- `backend/src/middleware/auth.ts` — add companyId to AuthRequest, add resolveCompanyMiddleware

---

### 1C: Row Level Security on all tables

**What to do:**

Run this SQL in the Supabase SQL editor. This creates RLS policies so even if the backend has a bug, the DB layer prevents cross-tenant data access.

> Note: The backend uses the `SUPABASE_SERVICE_ROLE_KEY` which bypasses RLS. RLS protects against: (1) direct Supabase client queries from the frontend, (2) queries using the anon key, (3) future code paths that use the user JWT client. It's defense-in-depth.

```sql
-- Helper function: get the company_id for the currently authenticated user
CREATE OR REPLACE FUNCTION get_my_company_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT company_id FROM profiles WHERE id = auth.uid()
$$;

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_attributes ENABLE ROW LEVEL SECURITY;
ALTER TABLE personas ENABLE ROW LEVEL SECURITY;
ALTER TABLE opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE opportunity_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE communications ENABLE ROW LEVEL SECURITY;
ALTER TABLE communication_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE processed_webhook_events ENABLE ROW LEVEL SECURITY;

-- profiles: users can only see/edit their own profile
CREATE POLICY "profiles_self" ON profiles FOR ALL USING (id = auth.uid());

-- companies: users can only see their own company
CREATE POLICY "companies_tenant" ON companies FOR ALL USING (id = get_my_company_id());

-- customers: scoped by company_id
CREATE POLICY "customers_tenant" ON customers FOR ALL USING (company_id = get_my_company_id());

-- products: scoped by company_id
CREATE POLICY "products_tenant" ON products FOR ALL USING (company_id = get_my_company_id());

-- orders: scoped via customer → company_id
CREATE POLICY "orders_tenant" ON orders FOR ALL
  USING (customer_id IN (SELECT id FROM customers WHERE company_id = get_my_company_id()));

-- order_items: scoped via order → customer → company_id
CREATE POLICY "order_items_tenant" ON order_items FOR ALL
  USING (order_id IN (
    SELECT o.id FROM orders o
    JOIN customers c ON o.customer_id = c.id
    WHERE c.company_id = get_my_company_id()
  ));

-- customer_metrics: scoped via customer → company_id
CREATE POLICY "customer_metrics_tenant" ON customer_metrics FOR ALL
  USING (customer_id IN (SELECT id FROM customers WHERE company_id = get_my_company_id()));

-- customer_attributes: scoped via customer → company_id
CREATE POLICY "customer_attributes_tenant" ON customer_attributes FOR ALL
  USING (customer_id IN (SELECT id FROM customers WHERE company_id = get_my_company_id()));

-- personas: direct company_id column
CREATE POLICY "personas_tenant" ON personas FOR ALL USING (company_id = get_my_company_id());

-- opportunities: direct company_id column
CREATE POLICY "opportunities_tenant" ON opportunities FOR ALL USING (company_id = get_my_company_id());

-- opportunity_customers: scoped via opportunity → company_id
CREATE POLICY "opportunity_customers_tenant" ON opportunity_customers FOR ALL
  USING (opportunity_id IN (SELECT id FROM opportunities WHERE company_id = get_my_company_id()));

-- campaigns: direct company_id column
CREATE POLICY "campaigns_tenant" ON campaigns FOR ALL USING (company_id = get_my_company_id());

-- communications: scoped via campaign → company_id
CREATE POLICY "communications_tenant" ON communications FOR ALL
  USING (campaign_id IN (SELECT id FROM campaigns WHERE company_id = get_my_company_id()));

-- communication_events: scoped via communication → campaign → company_id
CREATE POLICY "communication_events_tenant" ON communication_events FOR ALL
  USING (communication_id IN (
    SELECT comm.id FROM communications comm
    JOIN campaigns c ON comm.campaign_id = c.id
    WHERE c.company_id = get_my_company_id()
  ));

-- agents: direct company_id column
CREATE POLICY "agents_tenant" ON agents FOR ALL USING (company_id = get_my_company_id());

-- agent_actions: scoped via agent → company_id
CREATE POLICY "agent_actions_tenant" ON agent_actions FOR ALL
  USING (agent_id IN (SELECT id FROM agents WHERE company_id = get_my_company_id()));

-- processed_webhook_events: no tenant scoping needed (internal dedup table)
-- Service role bypasses RLS so backend can still write here
CREATE POLICY "webhook_events_service_only" ON processed_webhook_events FOR ALL USING (false);
```

---

### 1D: Security hardening

**What to do:**

1. **Remove `.env.local` from git tracking:**
```bash
git rm --cached frontend/.env.local
echo "frontend/.env.local" >> .gitignore
git commit -m "remove env.local from tracking"
```
Then rotate ALL keys in Supabase dashboard (the committed keys are compromised).

2. **Remove hardcoded webhook secret from `render.yaml`** — replace with:
```yaml
envVars:
  - key: WEBHOOK_SECRET
    sync: false  # user must set in Render dashboard
```

3. **Remove webhook secret fallback in `backend/src/services/webhooks.ts`:**
```typescript
// BEFORE:
const secret = process.env.WEBHOOK_SECRET || 'growthOS-webhook-secret-dev';
// AFTER:
const secret = process.env.WEBHOOK_SECRET;
if (!secret) throw new Error('WEBHOOK_SECRET env var is required');
```

4. **Add helmet to backend `server.ts`:**
```typescript
import helmet from 'helmet';
app.use(helmet());
```
Run: `npm install helmet @types/helmet` in backend/

5. **Restrict CORS:**
```typescript
// BEFORE:
app.use(cors());
// AFTER:
app.use(cors({
  origin: [
    process.env.FRONTEND_URL ?? 'http://localhost:3000',
    'https://your-vercel-domain.vercel.app',  // replace with real domain
  ],
  credentials: true,
}));
```

6. **Create `.env.example` files** for backend, frontend, and channel-service listing all required env vars with placeholder values (no real secrets).

**Files to change:**
- `backend/src/services/webhooks.ts`
- `backend/src/server.ts`
- `render.yaml`
- `.gitignore`
- Create: `backend/.env.example`, `frontend/.env.example`, `channel-service/.env.example`

---

## PHASE 2 — Real Channel Integrations
**Status: TODO**
**Depends on: Phase 1 complete**

### 2A: Channel service provider abstraction

**What to do:**

Restructure `channel-service/` to support pluggable providers:

```
channel-service/
  src/
    providers/
      base.ts          ← interface: send(message) → { providerMessageId }
      simulator.ts     ← current behavior (random delays + webhooks)
      resend.ts        ← email via Resend API
      twilio-sms.ts    ← SMS via Twilio
      twilio-whatsapp.ts ← WhatsApp via Twilio
    router.ts          ← picks provider based on channel + config
    server.ts          ← existing Express server (update to use router)
    queue.ts           ← existing in-memory queue (keep for now)
    webhook.ts         ← existing webhook emitter
```

The `base.ts` interface:
```typescript
export interface ChannelProvider {
  send(payload: {
    to: string;          // phone or email
    message: string;
    communicationId: string;
    campaignId: string;
  }): Promise<{ providerMessageId: string }>;
}
```

The `router.ts` picks the provider:
```typescript
export function getProvider(channel: string, config: CompanyChannelConfig): ChannelProvider {
  if (channel === 'email' && config.resendApiKey) return new ResendProvider(config.resendApiKey);
  if (channel === 'sms' && config.twilioAccountSid) return new TwilioSmsProvider(config);
  if (channel === 'whatsapp' && config.twilioAccountSid) return new TwilioWhatsAppProvider(config);
  return new SimulatorProvider();  // fallback
}
```

Add a `channel_integrations` table to the DB:
```sql
CREATE TABLE channel_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  channel TEXT NOT NULL,        -- 'email', 'sms', 'whatsapp'
  provider TEXT NOT NULL,       -- 'resend', 'twilio', 'simulator'
  config JSONB NOT NULL DEFAULT '{}',  -- encrypted API keys stored here
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, channel)
);
ALTER TABLE channel_integrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "channel_integrations_tenant" ON channel_integrations
  FOR ALL USING (company_id = get_my_company_id());
```

> **Security note:** API keys in the config JSONB should be encrypted at rest. Use `pgsodium` (built into Supabase) or store a reference to a secret stored in Supabase Vault.

The channel service needs to fetch the company's channel config before sending. The backend should pass `companyId` in the send payload so the channel service can look up the right provider config.

**Files to create/change:**
- `channel-service/src/providers/base.ts` (new)
- `channel-service/src/providers/simulator.ts` (extract from queue.ts)
- `channel-service/src/router.ts` (new)
- `channel-service/src/server.ts` (update POST /send to use router)
- DB: add `channel_integrations` table
- `backend/src/services/campaigns.ts` — update `launchCampaign()` to pass `companyId` in channel service payload

---

### 2B: Resend email integration

**What to do:**

1. Install: `npm install resend` in channel-service/
2. Create `channel-service/src/providers/resend.ts`:
```typescript
import { Resend } from 'resend';
import type { ChannelProvider } from './base';

export class ResendProvider implements ChannelProvider {
  private client: Resend;
  constructor(apiKey: string) {
    this.client = new Resend(apiKey);
  }
  async send({ to, message, communicationId }) {
    const { data, error } = await this.client.emails.send({
      from: 'Xeno Growth <campaigns@yourdomain.com>',
      to,
      subject: 'A message from your brand',
      html: buildEmailHtml(message),  // see below
    });
    if (error) throw new Error(error.message);
    return { providerMessageId: data!.id };
  }
}

function buildEmailHtml(message: string): string {
  return `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
      <p style="font-size: 16px; line-height: 1.6; color: #333;">${message}</p>
      <hr style="margin: 24px 0; border: none; border-top: 1px solid #eee;" />
      <p style="font-size: 12px; color: #999;">
        You're receiving this because you opted in. 
        <a href="#">Unsubscribe</a>
      </p>
    </div>
  `;
}
```

3. Add settings UI in `frontend/app/settings/page.tsx` — "Channel Integrations" section with a form to enter Resend API key, which calls `POST /api/settings/channels` to save to `channel_integrations` table.

4. Add backend route:
```typescript
// POST /api/settings/channels — save channel integration config
app.post('/api/settings/channels', requireAuth, resolveCompanyMiddleware, async (req, res) => {
  const { channel, provider, config } = req.body;
  // upsert into channel_integrations for req.companyId
});

// GET /api/settings/channels — get configured channels (mask API keys)
app.get('/api/settings/channels', requireAuth, resolveCompanyMiddleware, async (req, res) => {
  // return channel configs with API keys masked as "••••••••"
});
```

**Files to create/change:**
- `channel-service/src/providers/resend.ts` (new)
- `channel-service/package.json` (add resend)
- `frontend/app/settings/page.tsx` (add channel config UI)
- `backend/src/server.ts` (add /api/settings/channels routes)

---

### 2C: Twilio SMS + WhatsApp

**What to do:**

1. Install: `npm install twilio` in channel-service/
2. Create `channel-service/src/providers/twilio-sms.ts`:
```typescript
import twilio from 'twilio';
export class TwilioSmsProvider implements ChannelProvider {
  async send({ to, message, communicationId }) {
    const client = twilio(this.config.accountSid, this.config.authToken);
    const msg = await client.messages.create({
      body: message,
      from: this.config.phoneNumber,
      to,
      statusCallback: `${process.env.CRM_WEBHOOK_URL}`,  // Twilio will call this with delivery updates
    });
    return { providerMessageId: msg.sid };
  }
}
```

3. Create `channel-service/src/providers/twilio-whatsapp.ts` — same but `from: 'whatsapp:+14155238886'` (sandbox) or approved WABA number.

> **WhatsApp note:** WhatsApp Business API requires Meta approval. Using the Twilio sandbox (`whatsapp:+14155238886`) works for testing by having the recipient text "join <sandbox-word>" first. Production requires a WABA approval through Twilio/Meta which can take 1-7 days.

4. Twilio sends delivery status webhooks to a URL you configure — the channel service needs a `POST /webhooks/twilio` endpoint that translates Twilio status codes to the app's status state machine and then fires the webhook to the backend.

**Files to create/change:**
- `channel-service/src/providers/twilio-sms.ts` (new)
- `channel-service/src/providers/twilio-whatsapp.ts` (new)
- `channel-service/src/server.ts` (add POST /webhooks/twilio endpoint)
- `channel-service/package.json` (add twilio)

---

## PHASE 3 — Code Quality
**Status: TODO**
**Can be done alongside Phase 2**

### 3A: TypeScript strict mode

**What to do:**

1. In `backend/tsconfig.json`, change:
```json
{ "strict": false }
→
{ "strict": true }
```

2. Run `npx tsc --noEmit` in backend/ to see all errors.
3. Common fixes needed:
   - Add `| null` to return types of async functions that can return null
   - Add null checks before accessing `.id` on possibly-undefined query results
   - Replace `any` types with proper interfaces
   - Add explicit return types to route handlers

**Files to change:**
- `backend/tsconfig.json`
- Many files in `backend/src/` (fix type errors)

---

### 3B: Replace console.log with pino logger

**What to do:**

The pino logger is already created in `server.ts` as `export const logger`. The problem is it's not used.

1. Create `backend/src/lib/logger.ts` that exports a shared logger instance (avoids circular imports):
```typescript
import pino from 'pino';
export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  ...(process.env.NODE_ENV !== 'production' && { transport: { target: 'pino-pretty' } }),
});
```

2. In `server.ts`, import from lib/logger instead of creating a new instance.

3. In every service file, replace:
```typescript
console.log(`[opportunities] Found ${count} opportunities`)
→
logger.info({ count }, 'opportunities found')

console.error('Failed to generate:', err)
→
logger.error({ err }, 'Failed to generate opportunities')
```

4. The pattern for structured pino logging:
- First arg: object with context `{ companyId, count, err }`
- Second arg: message string
- Level: `info` for normal flow, `warn` for unexpected but handled, `error` for caught exceptions

**Files to change:**
- Create `backend/src/lib/logger.ts`
- `backend/src/server.ts` (53+ calls)
- `backend/src/services/opportunities.ts` (7+ calls)
- `backend/src/services/campaigns.ts`
- `backend/src/services/personas.ts`
- `backend/src/services/analytics.ts`
- `backend/src/services/webhooks.ts`
- All other service files

---

### 3C: Zod validation schemas

**What to do:**

1. Create `backend/src/schemas/` directory with schema files.

2. Create `backend/src/middleware/validate.ts`:
```typescript
import { ZodSchema } from 'zod';
import type { Request, Response, NextFunction } from 'express';

export function validateBody(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: result.error.flatten().fieldErrors,
      });
    }
    req.body = result.data;  // replace with parsed/coerced data
    next();
  };
}
```

3. Key schemas to create:

`backend/src/schemas/onboarding.ts`:
```typescript
import { z } from 'zod';
export const businessSchema = z.object({
  companyName: z.string().min(1).max(100),
  industry: z.string().optional(),
});
export const profileSchema = z.object({
  goal: z.string().min(1),
  mode: z.enum(['autopilot', 'supervised']),
});
```

`backend/src/schemas/campaigns.ts`:
```typescript
export const generateCampaignSchema = z.object({
  opportunityId: z.string().uuid(),
  channel: z.enum(['email', 'sms', 'whatsapp', 'push']),
  tone: z.string().optional(),
});
export const refineCampaignSchema = z.object({
  instruction: z.string().min(1).max(500),
});
```

4. Wire into routes:
```typescript
app.post('/api/onboarding/business', requireAuth, validateBody(businessSchema), async (req, res) => {
```

5. Add file upload validation to CSV upload routes:
```typescript
// Max file size: 10MB
// Accepted MIME types: text/csv, application/csv, text/plain
```

**Files to create/change:**
- Create `backend/src/middleware/validate.ts`
- Create `backend/src/schemas/onboarding.ts`
- Create `backend/src/schemas/campaigns.ts`
- Create `backend/src/schemas/opportunities.ts`
- Create `backend/src/schemas/agents.ts`
- `backend/src/server.ts` (add validateBody to all POST/PATCH routes)

---

### 3D: Centralized error handler + request ID

**What to do:**

1. Add request ID middleware near the top of `server.ts`:
```typescript
import { nanoid } from 'nanoid';
app.use((req: Request, res: Response, next: NextFunction) => {
  const requestId = nanoid(10);
  req.headers['x-request-id'] = requestId;
  res.setHeader('X-Request-Id', requestId);
  next();
});
```

2. Add centralized error handler at the BOTTOM of `server.ts` (after all routes):
```typescript
app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
  const requestId = req.headers['x-request-id'] as string;
  logger.error({ err, requestId, url: req.url }, 'Unhandled error');
  res.status(500).json({
    error: 'Internal server error',
    requestId,
  });
});
```

3. In route handlers, instead of `res.status(500).json({ error: ... })`, call `next(err)` to let the centralized handler process it.

**Files to change:**
- `backend/src/server.ts`

---

### 3E: GitHub Actions CI

**What to do:**

Create `.github/workflows/ci.yml`:
```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  backend:
    name: Backend — typecheck + lint
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: backend
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
          cache-dependency-path: backend/package-lock.json
      - run: npm ci
      - run: npx tsc --noEmit
      - run: npm test  # once tests exist

  frontend:
    name: Frontend — typecheck + lint
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: frontend
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
          cache-dependency-path: frontend/package-lock.json
      - run: npm ci
      - run: npx tsc --noEmit
      - run: npm run lint

  channel-service:
    name: Channel service — typecheck
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: channel-service
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
          cache-dependency-path: channel-service/package-lock.json
      - run: npm ci
      - run: npx tsc --noEmit
```

**Files to create:**
- `.github/workflows/ci.yml`

---

## PHASE 4 — Reliability Fixes
**Status: TODO**

### 4A: DB-backed ingestion status

**What to do:**

Currently `server.ts` has:
```typescript
const ingestionStatus: Record<string, any> = {};  // IN-MEMORY — lost on restart
```

Replace with a DB model:

1. Add to Prisma schema:
```prisma
model IngestionSession {
  id          String   @id @default(uuid())
  companyId   String   @map("company_id")
  status      String   @default("pending")  // pending | processing | complete | error
  step        String?  // current step description
  progress    Int      @default(0)          // 0-100
  errorMessage String? @map("error_message")
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")

  @@index([companyId])
  @@map("ingestion_sessions")
}
```

2. In `processIngestion()`, replace all `ingestionStatus[sessionId]` writes with Prisma updates:
```typescript
await prisma.ingestionSession.update({
  where: { id: sessionId },
  data: { status: 'processing', step: 'Importing customers', progress: 20 }
});
```

3. In `GET /api/ingestion-status/:sessionId`, replace in-memory lookup with:
```typescript
const session = await prisma.ingestionSession.findUnique({ where: { id: sessionId } });
```

**Files to change:**
- `backend/prisma/schema.prisma` (add IngestionSession)
- `backend/src/server.ts` (replace in-memory ingestionStatus, update processIngestion, update status route)

---

### 4B: Fix hardcoded intelligence-preview data

**What to do:**

In `server.ts`, find `GET /api/intelligence-preview`. It returns hardcoded values:
```typescript
activeCustomers: 68,   // hardcoded %
dormantCustomers: 12,  // hardcoded %
atRiskCustomers: 20,   // hardcoded %
```

Replace with real queries:
```typescript
const { data: metrics } = await supabase
  .from('customer_metrics')
  .select('days_since_last_order, customer_id')
  .eq('customers.company_id', companyId)  // join needed

// Active: days_since_last_order < 30
// Dormant: days_since_last_order 30-90
// At-risk: days_since_last_order > 90 or null
```

Use a raw Prisma query for the join since Supabase client join syntax is awkward here.

---

### 4C: Pagination on list endpoints

**What to do:**

Add to these endpoints: `GET /api/opportunities`, `GET /api/campaigns`, `GET /api/analytics/activity-feed`

Query params: `?page=1&pageSize=20`

Response shape:
```typescript
{
  data: [...],
  pagination: {
    total: 100,
    page: 1,
    pageSize: 20,
    totalPages: 5,
    hasMore: true,
  }
}
```

Update frontend list pages to handle pagination (add page controls).

---

### 4D: Dead code cleanup

**What to do:**

1. **Delete `refineCampaignMessage()` from `frontend/lib/api.ts`** — around line 479. It calls `POST /campaigns/refine-message` which doesn't exist in `server.ts`. The working function is `refineCampaign()` which calls `/:id/refine`.

2. **Remove `recharts` from `backend/package.json`** — it belongs in frontend only.

3. **Remove commented-out code blocks** throughout backend services.

4. **Rename `docs/opurtunity engine.md`** to `docs/opportunity-engine.md`.

---

## PHASE 5 — Tests
**Status: TODO**
**Priority: Medium — needed for senior roles, but do after everything else works**

### 5: Integration tests

**What to do:**

1. Install in backend/: `npm install -D vitest supertest @types/supertest`

2. Create `backend/src/tests/` directory.

3. Key test cases (in order of priority):
   - `onboarding.test.ts` — POST /api/onboarding/business creates company + profile
   - `opportunities.test.ts` — GET /api/opportunities returns array, scoped to company
   - `campaigns.test.ts` — generate → save → approve → launch full flow
   - `auth.test.ts` — unauthenticated requests return 401, cross-tenant requests return 403

4. Use a test Supabase project (separate from prod) or mock Prisma with `vitest.mock`.

5. Add to CI: `npm test` step in `.github/workflows/ci.yml`.

---

## ENVIRONMENT VARIABLES REFERENCE

### Backend (`backend/.env`)
```
PORT=3001
DATABASE_URL=postgresql://...
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
OPENROUTER_API_KEY=sk-or-...
CHANNEL_SERVICE_URL=https://xeno-channel-service-0dpu.onrender.com
WEBHOOK_SECRET=<random 32-char string — generate with: openssl rand -base64 32>
REDIS_URL=redis://...    # optional, falls back gracefully
LOG_LEVEL=info
FRONTEND_URL=https://your-app.vercel.app
NODE_ENV=production
```

### Frontend (`frontend/.env.local`)
```
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
NEXT_PUBLIC_API_URL=https://xeno-crm-backend-n6d8.onrender.com
```

### Channel Service (`channel-service/.env`)
```
PORT=5001
CRM_WEBHOOK_URL=https://xeno-crm-backend-n6d8.onrender.com/api/webhooks/channel-status
WEBHOOK_SECRET=<same secret as backend>
FAILURE_RATE=5
QUEUED_TO_SENT_DELAY=2000
SENT_TO_DELIVERED_DELAY=3000
DELIVERED_TO_READ_DELAY=5000
READ_TO_CLICKED_DELAY=4000
RESEND_API_KEY=re_...           # for email
TWILIO_ACCOUNT_SID=AC...        # for SMS/WhatsApp
TWILIO_AUTH_TOKEN=...
TWILIO_PHONE_NUMBER=+1...       # for SMS
TWILIO_WHATSAPP_NUMBER=+1...    # for WhatsApp
```

---

## DEMO SCRIPT (for interviews)

1. Sign up with a real email
2. Go through onboarding: enter company name → upload sample CSV → set goal → enable autopilot
3. Show the AI ingestion pipeline running (progress bar)
4. Land on dashboard — show AI-discovered opportunities with revenue estimates
5. Click an opportunity → show audience breakdown → "Generate Campaign"
6. Show AI writing the campaign message in real time
7. Approve → Launch → Show communications being sent
8. If email integrated: open your inbox and show the actual email arriving
9. Watch the analytics update: delivery → read → click → conversion
10. Show the AI agent activity stream (autonomous discoveries)

**Key talking points:**
- "Defense-in-depth security: API-level auth enforcement + database-level RLS"
- "Real multi-tenancy — every query is scoped, no cross-tenant data leakage possible at the DB layer"
- "AI agents that run autonomously, discover opportunities, and launch campaigns without human intervention"
- "Full communication lifecycle tracking from QUEUED → DELIVERED → CONVERTED with HMAC-verified webhooks"
- "Real email/SMS delivery via Resend and Twilio"

---

## KNOWN BUGS (fix as part of phases)

1. `frontend/lib/api.ts:479` — `refineCampaignMessage()` calls `POST /campaigns/refine-message` (doesn't exist). Fix: delete the function. ✅ (Phase 4D)
2. In-memory ingestion status — lost on cold start. Fix: DB-backed IngestionSession. ✅ (Phase 4A)
3. Hardcoded customer health percentages in `/api/intelligence-preview`. Fix: real DB query. ✅ (Phase 4B)
4. `recharts` in backend `package.json`. Fix: remove it. ✅ (Phase 4D)
5. Backend `tsconfig.json` has `"strict": false`. Fix: enable strict. ✅ (Phase 3A)
6. 53+ `console.log` calls in server.ts (pino logger exists but unused). Fix: replace all. ✅ (Phase 3B)
7. `frontend/.env.local` committed to git with live credentials. Fix: remove from tracking, rotate keys. ✅ (Phase 1D)
8. Hardcoded `xeno-webhook-secret-prod-1234` in `render.yaml`. Fix: env var only. ✅ (Phase 1D)
9. CORS allows all origins. Fix: whitelist production domains. ✅ (Phase 1D)
10. No GitHub Actions CI. Fix: add workflow. ✅ (Phase 3E)
11. Zero tests. Fix: vitest + supertest integration tests. ✅ (Phase 5)

---

## PROGRESS TRACKER

- [ ] Phase 1A: Profiles table + schema formalization
- [ ] Phase 1B: requireAuth everywhere + companyId from JWT only
- [ ] Phase 1C: RLS on all 16 tables
- [ ] Phase 1D: Security hardening (secrets, CORS, helmet)
- [ ] Phase 2A: Channel service provider abstraction
- [ ] Phase 2B: Resend email integration
- [ ] Phase 2C: Twilio SMS + WhatsApp
- [ ] Phase 3A: TypeScript strict mode
- [ ] Phase 3B: Replace console.log with pino
- [ ] Phase 3C: Zod validation schemas
- [ ] Phase 3D: Centralized error handler + request ID
- [ ] Phase 3E: GitHub Actions CI
- [ ] Phase 4A: DB-backed ingestion status
- [ ] Phase 4B: Fix hardcoded intelligence-preview
- [ ] Phase 4C: Pagination on list endpoints
- [ ] Phase 4D: Dead code cleanup
- [ ] Phase 5: Integration tests

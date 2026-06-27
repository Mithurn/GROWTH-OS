import { randomUUID } from 'crypto';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import multer from 'multer';
import csvParser from 'csv-parser';
import { createClient } from '@supabase/supabase-js';
import { Readable } from 'stream';
import WebSocket from 'ws';
import 'dotenv/config';
import rateLimit from 'express-rate-limit';
import pinoHttp from 'pino-http';
import { fashionProducts, seedProducts } from './data-generator/products';
import { generateCustomerAttributes } from './services/customer-attributes';
import { generateCustomerMetrics } from './services/customer-metrics';
import { generateOpportunities, getOpportunityCustomers, getOpportunityDashboard, createOpportunityFromGoal, refineOpportunity } from './services/opportunities';
import { generatePersonas, getPersonaCustomers, getPersonaDistribution } from './services/personas';
import { generateCampaign, saveCampaign, approveCampaign, launchCampaign, getCampaigns, getCampaignById, refineCampaignMessage } from './services/campaigns';
import { verifySignature, processWebhook, type WebhookEvent } from './services/webhooks';
import {
  generateIntelligenceBrief,
  getCampaignFunnel,
  getOpportunityPipeline,
  getChannelPerformance,
  getOpportunityDistribution,
  getOpportunityTrend,
  getActivityFeed,
  getRecommendedActions,
  getCampaignAnalytics,
} from './services/analytics';
import { agentOrchestrator } from './services/agent-orchestrator';
import { getRecentActions } from './services/agent-logger';
import { startWorkers } from './lib/queues';
import { prisma } from './lib/prisma';
import { startConversation, sendMessage, getConversation } from './services/onboarding-chat';
import { getCached, setCached } from './lib/cache';
import { subscribeToActivity } from './lib/activity-emitter';
import { requireAuth, resolveCompanyMiddleware, softAuth, type AuthRequest } from './middleware/auth';
import { logger } from './lib/logger';
import { validateBody } from './middleware/validate';
import { errorHandler } from './middleware/errorHandler';
import {
  OnboardingBusinessSchema,
  OnboardingProfileSchema,
  ConversationMessageSchema,
  OnboardingCompleteSchema,
  GeneratePersonasSchema,
  GenerateOpportunitiesSchema,
  RefineOpportunitySchema,
  CreateOpportunityFromGoalSchema,
  GenerateCampaignSchema,
  SaveCampaignSchema,
  RefineCampaignSchema,
  CreateAgentSchema,
  PatchAgentSchema,
} from './lib/schemas';

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

// ── Rate limiters ────────────────────────────────────────────────────────────
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});

const llmLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'AI rate limit reached, please wait a moment.' },
});

// ── Middleware ───────────────────────────────────────────────────────────────
app.use((_req, res, next) => {
  res.setHeader('x-request-id', `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);
  next();
});
app.use(helmet());
app.use(cors({
  origin: [
    process.env.FRONTEND_URL ?? 'http://localhost:3000',
    /\.vercel\.app$/,  // allow all Vercel preview deployments
  ],
  credentials: true,
}));
app.use(express.json());
app.use(pinoHttp({ logger, autoLogging: { ignore: (req) => req.url === '/health' } }));
app.use('/api', generalLimiter);

// Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    realtime: {
      transport: WebSocket as any
    }
  }
);


// Helper: Parse CSV from buffer
function parseCSV(buffer: Buffer): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const results: any[] = [];
    const stream = Readable.from(buffer);

    stream
      .pipe(csvParser())
      .on('data', (data) => results.push(data))
      .on('end', () => resolve(results))
      .on('error', (error) => reject(error));
  });
}

// GET /health
app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// GET /api/sse/activity — SSE stream for real-time agent activity
app.get('/api/sse/activity', requireAuth, resolveCompanyMiddleware, (req: AuthRequest, res) => {
  const unsubscribe = subscribeToActivity(res, req.companyId!);
  req.on('close', unsubscribe);
});

// GET /api/companies/:id
app.get('/api/companies/:id', requireAuth, resolveCompanyMiddleware, async (req: AuthRequest, res) => {
  try {
    const id = req.params["id"] as string;

    if (id !== req.companyId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { data, error } = await supabase
      .from('companies')
      .select('*')
      .eq('id', req.companyId)
      .single();

    if (error) throw error;

    res.json({ success: true, data });
  } catch (error) {
    logger.error({ err: error }, 'Error fetching company');
    res.status(500).json({ error: 'Failed to fetch company' });
  }
});

// POST /api/onboarding/business
app.post('/api/onboarding/business', requireAuth, validateBody(OnboardingBusinessSchema), async (req: AuthRequest, res) => {
  try {
    const { companyName, industry } = req.body;

    // If user already has a company, return it — prevents duplicates on re-run
    const { data: existing } = await supabase
      .from('profiles')
      .select('company_id, companies(id, company_name, industry)')
      .eq('id', req.userId!)
      .maybeSingle();

    if (existing?.companies) {
      return res.json({ success: true, data: existing.companies });
    }

    const { data: company, error } = await supabase
      .from('companies')
      .insert({ company_name: companyName, industry, user_id: req.userId })
      .select('id, company_name, industry')
      .single();

    if (error) throw error;

    // Create profile linking this user to the new company
    await supabase.from('profiles').insert({
      id: req.userId,
      company_id: company.id,
      role: 'owner',
    });

    res.json({ success: true, data: company });
  } catch (error) {
    logger.error({ err: error }, 'Error saving business info');
    res.status(500).json({ error: 'Failed to save business info' });
  }
});

// POST /api/onboarding/profile
app.post('/api/onboarding/profile', requireAuth, resolveCompanyMiddleware, validateBody(OnboardingProfileSchema), async (req: AuthRequest, res) => {
  try {
    const { profile } = req.body;

    const { data, error } = await supabase
      .from('companies')
      .update({
        onboarding_profile: profile,
        onboarding_completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', req.companyId)
      .select('id, company_name, industry, onboarding_profile, onboarding_completed_at')
      .single();

    if (error) throw error;

    res.json({ success: true, data });
  } catch (error) {
    logger.error({ err: error }, 'Error saving onboarding profile');
    res.status(500).json({ error: 'Failed to save onboarding profile' });
  }
});

// POST /api/onboarding/conversation/start
app.post('/api/onboarding/conversation/start', requireAuth, resolveCompanyMiddleware, async (req: AuthRequest, res) => {
  try {
    const conversation = await startConversation(supabase, req.companyId!);
    res.json({ success: true, data: conversation });
  } catch (error) {
    logger.error({ err: error }, 'Error starting conversation');
    res.status(500).json({ error: 'Failed to start conversation' });
  }
});

// POST /api/onboarding/conversation/:id/message
app.post('/api/onboarding/conversation/:id/message', requireAuth, validateBody(ConversationMessageSchema), async (req: AuthRequest, res) => {
  try {
    const id = req.params["id"] as string;
    const { message } = req.body;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'message is required' });
    }

    const conversation = await sendMessage(supabase, id, message);
    res.json({ success: true, data: conversation });
  } catch (error) {
    logger.error({ err: error }, 'Error sending message');
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// GET /api/onboarding/conversation/:id
app.get('/api/onboarding/conversation/:id', requireAuth, async (req: AuthRequest, res) => {
  try {
    const id = req.params["id"] as string;
    const conversation = await getConversation(supabase, id);

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    res.json({ success: true, data: conversation });
  } catch (error) {
    logger.error({ err: error }, 'Error fetching conversation');
    res.status(500).json({ error: 'Failed to fetch conversation' });
  }
});

// POST /api/onboarding/complete
app.post('/api/onboarding/complete', requireAuth, resolveCompanyMiddleware, validateBody(OnboardingCompleteSchema), async (req: AuthRequest, res) => {
  try {
    const { conversationId } = req.body;

    const conversation = await getConversation(supabase, conversationId);

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    if (!conversation.completed) {
      return res.status(400).json({ error: 'Conversation not completed yet' });
    }

    const extractedData = conversation.extractedData;

    const { data: company, error: companyError } = await supabase
      .from('companies')
      .update({
        onboarding_profile: extractedData,
        onboarding_completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', req.companyId)
      .select()
      .single();

    if (companyError) throw companyError;

    const priority = extractedData.priority?.[0] || 'Increase revenue';
    const channels = extractedData.channels || ['WhatsApp', 'Email'];
    const involvement = extractedData.involvement?.[0] || 'review major campaigns only';

    const agent = await prisma.agent.create({
      data: {
        companyId: req.companyId!,
        name: `${priority} Agent`,
        goal: priority,
        status: 'discovering',
        guardrails: {
          channels,
          involvement,
          max_budget: 100000,
          frequency_cap: 3,
        },
      },
    });

    logger.info({ companyId: req.companyId, agentId: agent.id }, 'Onboarding complete, agent created');

    res.json({ success: true, data: { company, agent } });
  } catch (error) {
    logger.error({ err: error }, 'Error completing onboarding');
    res.status(500).json({ error: 'Failed to complete onboarding' });
  }
});

// POST /api/upload/customers
app.post('/api/upload/customers', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const customers = await parseCSV(req.file.buffer);

    // Extract unique columns
    const columns = customers.length > 0 ? Object.keys(customers[0]) : [];

    res.json({
      success: true,
      preview: {
        totalCustomers: customers.length,
        columns,
        sampleRows: customers.slice(0, 3)
      }
    });
  } catch (error) {
    logger.error({ err: error }, 'Error parsing customer CSV');
    res.status(500).json({ error: 'Failed to parse customer CSV' });
  }
});

// POST /api/upload/orders
app.post('/api/upload/orders', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const orders = await parseCSV(req.file.buffer);

    // Get date range
    const dates = orders
      .map(o => o.order_date)
      .filter(Boolean)
      .sort();

    const dateRange = dates.length > 0
      ? { start: dates[0].substring(0, 7), end: dates[dates.length - 1].substring(0, 7) }
      : null;

    res.json({
      success: true,
      preview: {
        totalOrders: orders.length,
        dateRange,
        sampleRows: orders.slice(0, 3)
      }
    });
  } catch (error) {
    logger.error({ err: error }, 'Error parsing orders CSV');
    res.status(500).json({ error: 'Failed to parse orders CSV' });
  }
});

// POST /api/process-ingestion
app.post('/api/process-ingestion', requireAuth, resolveCompanyMiddleware, upload.fields([
  { name: 'customers', maxCount: 1 },
  { name: 'orders', maxCount: 1 }
]), async (req: AuthRequest, res) => {
  try {
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };

    if (!files.customers || !files.orders) {
      return res.status(400).json({ error: 'Both customer and order files required' });
    }

    const session = await prisma.ingestionSession.create({
      data: { companyId: req.companyId!, status: 'pending', step: 'Starting...', progress: 0 },
    });

    processIngestion(session.id, files.customers[0].buffer, files.orders[0].buffer, req.companyId!);

    res.json({ success: true, sessionId: session.id });
  } catch (error) {
    logger.error({ err: error }, 'Error starting ingestion');
    res.status(500).json({ error: 'Failed to start ingestion' });
  }
});

// GET /api/ingestion-status/:sessionId
app.get('/api/ingestion-status/:sessionId', requireAuth, async (req: AuthRequest, res) => {
  try {
    const sessionId = req.params["sessionId"] as string;
    const session = await prisma.ingestionSession.findUnique({ where: { id: sessionId } });
    if (!session) return res.json({ step: 'not_found', progress: 0 });
    res.json({ step: session.step, progress: session.progress, message: session.step, status: session.status, error: session.errorMessage });
  } catch (error) {
    logger.error({ err: error }, 'Error fetching ingestion status');
    res.status(500).json({ error: 'Failed to fetch ingestion status' });
  }
});

// Async ingestion process
async function processIngestion(sessionId: string, customerBuffer: Buffer, orderBuffer: Buffer, companyId: string) {
  try {
    await updateStatus(sessionId, 'validating', 10, 'Validating data...');
    await sleep(500);

    await updateStatus(sessionId, 'parsing', 20, 'Parsing CSV files...');
    const customers = await parseCSV(customerBuffer);
    const orders = await parseCSV(orderBuffer);

    await updateStatus(sessionId, 'seeding_products', 30, 'Seeding products...');
    await seedProductsFromCSV(companyId, orders);

    await updateStatus(sessionId, 'importing_customers', 40, 'Importing customers...');
    const customerMap = await importCustomers(customers, companyId);

    await updateStatus(sessionId, 'importing_orders', 60, 'Importing orders and products...');
    const orderImportSummary = await importOrders(orders, customerMap, companyId);
    await updateStatus(sessionId, 'importing_orders', 72,
      `Imported ${orderImportSummary.ordersInserted} orders and ${orderImportSummary.orderItemsInserted} order items...`);

    await updateStatus(sessionId, 'calculating_metrics', 80, 'Calculating customer metrics...');
    const metricsReport = await generateCustomerMetricsWithVerification(companyId);
    await updateStatus(sessionId, 'validating_metrics', 85,
      `Validated ${metricsReport.totalMetricsRecords}/${metricsReport.totalCustomers} customer metrics records...`);

    await updateStatus(sessionId, 'calculating_attributes', 90, 'Calculating customer attributes...');
    const attributesReport = await generateCustomerAttributesWithVerification(companyId);
    await updateStatus(sessionId, 'validating_attributes', 93,
      `Validated ${attributesReport.totalAttributesRecords}/${attributesReport.totalCustomers} customer attributes records...`);

    await updateStatus(sessionId, 'generating_personas', 95, 'Generating customer personas with AI...');
    try {
      const personasReport = await generatePersonas(supabase, {
        companyId,
        logger: {
          info: (msg) => logger.info(msg),
          warn: (msg) => logger.warn(msg),
          error: (msg) => logger.error(msg),
        },
      });
      await updateStatus(sessionId, 'personas_complete', 98,
        `Generated ${personasReport.totalPersonas} personas for ${personasReport.personasAssigned} customers...`);
    } catch (personaError) {
      logger.warn({ err: personaError }, 'Persona generation failed, continuing with ingestion');
      await updateStatus(sessionId, 'personas_skipped', 98, 'Skipped persona generation (non-critical)');
    }

    await prisma.ingestionSession.update({
      where: { id: sessionId },
      data: { status: 'complete', step: 'Ingestion complete!', progress: 100 },
    });
  } catch (error) {
    logger.error({ err: error, sessionId }, 'Ingestion error');
    await prisma.ingestionSession.update({
      where: { id: sessionId },
      data: {
        status: 'error',
        errorMessage: error instanceof Error ? error.message : String(error),
        progress: 0,
      },
    }).catch(() => {});
  }
}

async function updateStatus(sessionId: string, step: string, progress: number, _message: string) {
  await prisma.ingestionSession.update({
    where: { id: sessionId },
    data: { status: 'processing', step, progress },
  });
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function generateCustomerMetricsWithVerification(companyId: string) {
  const firstPass = await generateCustomerMetrics(supabase, { companyId });
  if (firstPass.totalMetricsRecords >= firstPass.totalCustomers) return firstPass;

  logger.warn('customer_metrics incomplete after first pass, retrying...');
  await sleep(1000);
  const secondPass = await generateCustomerMetrics(supabase, { companyId });
  if (secondPass.totalMetricsRecords < secondPass.totalCustomers) {
    throw new Error(`Customer metrics incomplete after retry: ${secondPass.totalMetricsRecords}/${secondPass.totalCustomers}`);
  }
  return secondPass;
}

async function generateCustomerAttributesWithVerification(companyId: string) {
  const firstPass = await generateCustomerAttributes(supabase, { companyId });
  if (firstPass.totalAttributesRecords >= firstPass.totalCustomers) return firstPass;

  logger.warn('customer_attributes incomplete after first pass, retrying...');
  await sleep(1000);
  const secondPass = await generateCustomerAttributes(supabase, { companyId });
  if (secondPass.totalAttributesRecords < secondPass.totalCustomers) {
    throw new Error(`Customer attributes incomplete after retry: ${secondPass.totalAttributesRecords}/${secondPass.totalCustomers}`);
  }
  return secondPass;
}

// Extract unique products from CSV rows and upsert them as company-scoped records.
// This replaces the global product-seed approach so each company owns their product catalog.
async function seedProductsFromCSV(companyId: string, orders: any[]) {
  const seen = new Set<string>();
  const toInsert: any[] = [];

  for (const row of orders) {
    const sku = row.product_sku?.trim();
    if (!sku || seen.has(sku)) continue;
    seen.add(sku);
    toInsert.push({
      sku,
      product_name: row.product_name?.trim() || sku,
      category: row.category?.trim() || 'General',
      subcategory: row.subcategory?.trim() || null,
      price: parseFloat(row.unit_price || row.price || row.amount || '0') || 0,
      company_id: companyId,
    });
  }

  if (toInsert.length === 0) {
    logger.warn('No product SKUs found in orders CSV');
    return;
  }

  const { error } = await supabase
    .from('products')
    .upsert(toInsert, { onConflict: 'sku,company_id', ignoreDuplicates: true });

  if (error) throw new Error(`Failed to seed products: ${error.message}`);
  logger.info({ count: toInsert.length, companyId }, 'Products seeded');
}

async function importCustomers(customers: any[], companyId: string) {
  const customerMap = new Map<string, string>(); // external_id -> supabase_id

  for (let i = 0; i < customers.length; i += 100) {
    const batch = customers.slice(i, i + 100);

    const { data, error } = await supabase
      .from('customers')
      .insert(batch.map(c => ({
        external_customer_id: c.customer_id,
        first_name: c.first_name,
        last_name: c.last_name,
        email: c.email,
        phone: c.phone,
        gender: c.gender,
        city: c.city,
        state: c.state,
        signup_date: c.signup_date,
        company_id: companyId,
      })))
      .select('id, external_customer_id');

    if (error) throw error;

    data.forEach((customer: any) => {
      customerMap.set(customer.external_customer_id, customer.id);
    });
  }

  return customerMap;
}

async function importOrders(orders: any[], customerMap: Map<string, string>, companyId: string) {
  const { data: products } = await supabase.from('products').select('id, sku').eq('company_id', companyId);
  const productMap = new Map(products?.map(p => [p.sku, p.id]) || []);

  if (productMap.size === 0) {
    throw new Error('No products available for order item import');
  }

  // Group CSV rows by order_id
  const orderGroups = new Map<string, any[]>();
  orders.forEach(o => {
    if (!orderGroups.has(o.order_id)) orderGroups.set(o.order_id, []);
    orderGroups.get(o.order_id)!.push(o);
  });

  // Build both arrays in memory using pre-generated UUIDs so we can bulk-insert
  // orders and order_items without any round-trips to retrieve DB-generated IDs.
  const ordersToInsert: Array<{
    id: string;
    external_order_id: string;
    customer_id: string;
    order_date: string;
    total_amount: number;
    channel: string;
    company_id: string;
  }> = [];

  const orderItemsToInsert: Array<{
    order_id: string;
    product_id: string;
    quantity: number;
    unit_price: number;
  }> = [];

  let skippedOrders = 0;
  let skippedItems = 0;

  for (const [orderId, items] of orderGroups) {
    const customerId = customerMap.get(items[0].customer_id);
    if (!customerId) { skippedOrders++; continue; }

    const generatedOrderId = randomUUID();
    const totalAmount = items.reduce((sum: number, item: any) => sum + parseFloat(item.amount), 0);

    ordersToInsert.push({
      id: generatedOrderId,
      external_order_id: orderId,
      customer_id: customerId,
      order_date: items[0].order_date,
      total_amount: totalAmount,
      channel: items[0].channel || 'Website',
      company_id: companyId,
    });

    for (const item of items) {
      const productId = productMap.get(item.product_sku);
      if (!productId) {
        logger.warn({ sku: item.product_sku, orderId }, 'Unknown SKU in order, skipping item');
        skippedItems++;
        continue;
      }
      orderItemsToInsert.push({
        order_id: generatedOrderId,
        product_id: productId,
        quantity: parseInt(item.quantity) || 1,
        unit_price: parseFloat(item.amount) / (parseInt(item.quantity) || 1),
      });
    }
  }

  // Bulk insert in chunks of 1000 (Supabase payload limit)
  const CHUNK = 1000;
  let ordersInserted = 0;
  let orderItemsInserted = 0;

  for (let i = 0; i < ordersToInsert.length; i += CHUNK) {
    const { error } = await supabase.from('orders').insert(ordersToInsert.slice(i, i + CHUNK));
    if (error) {
      logger.error({ err: error, chunk: i / CHUNK }, 'Orders bulk insert error');
      skippedOrders += Math.min(CHUNK, ordersToInsert.length - i);
    } else {
      ordersInserted += Math.min(CHUNK, ordersToInsert.length - i);
    }
  }

  for (let i = 0; i < orderItemsToInsert.length; i += CHUNK) {
    const { error } = await supabase.from('order_items').insert(orderItemsToInsert.slice(i, i + CHUNK));
    if (error) {
      logger.error({ err: error, chunk: i / CHUNK }, 'Order items bulk insert error');
    } else {
      orderItemsInserted += Math.min(CHUNK, orderItemsToInsert.length - i);
    }
  }

  logger.info({ ordersInserted, orderItemsInserted, skippedOrders, skippedItems }, 'Orders import complete');

  return { ordersInserted, orderItemsInserted, skippedOrders, skippedItems };
}

// GET /api/intelligence-preview
app.get('/api/intelligence-preview', requireAuth, resolveCompanyMiddleware, async (req: AuthRequest, res) => {
  try {
    const companyId = req.companyId!;

    const { count: totalCustomers } = await supabase
      .from('customers')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', companyId);

    const { count: totalOrders } = await supabase
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .in('customer_id', supabase.from('customers').select('id').eq('company_id', companyId) as any);

    const { data: revenueData } = await supabase
      .from('orders')
      .select('total_amount')
      .in('customer_id', supabase.from('customers').select('id').eq('company_id', companyId) as any);

    const revenue = revenueData?.reduce((sum, o) => sum + parseFloat(o.total_amount.toString()), 0) || 0;
    const avgOrderValue = totalOrders ? revenue / totalOrders : 0;

    // Real customer health from customer_metrics (days_since_last_order)
    const { data: healthData } = await supabase
      .from('customer_metrics')
      .select('days_since_last_order')
      .in('customer_id', supabase.from('customers').select('id').eq('company_id', companyId) as any);

    let active = 0, atRisk = 0, dormant = 0;
    for (const row of healthData ?? []) {
      const days = row.days_since_last_order ?? 999;
      if (days <= 30) active++;
      else if (days <= 90) atRisk++;
      else dormant++;
    }

    const { data: topCustomers } = await supabase
      .from('customer_metrics')
      .select('customer_id, total_spent, customers(first_name, last_name)')
      .in('customer_id', supabase.from('customers').select('id').eq('company_id', companyId) as any)
      .order('total_spent', { ascending: false })
      .limit(3);

    res.json({
      totalCustomers,
      totalOrders,
      revenue,
      avgOrderValue,
      customerHealth: { active, dormant, atRisk },
      topCustomers: topCustomers?.map((c: any) => ({
        name: `${c.customers.first_name} ${c.customers.last_name}`,
        totalSpent: c.total_spent,
      })) || [],
    });
  } catch (error) {
    logger.error({ err: error }, 'Error fetching intelligence');
    res.status(500).json({ error: 'Failed to fetch intelligence' });
  }
});

app.post('/api/personas/generate', requireAuth, resolveCompanyMiddleware, llmLimiter, validateBody(GeneratePersonasSchema), async (req: AuthRequest, res) => {
  try {
    const { model } = req.body ?? {};
    const report = await generatePersonas(supabase, { companyId: req.companyId!, model });
    res.json({ success: true, data: report });
  } catch (error) {
    logger.error({ err: error }, 'Error generating personas');
    res.status(500).json({ error: 'Failed to generate personas' });
  }
});

app.post('/api/opportunities/generate', requireAuth, resolveCompanyMiddleware, llmLimiter, validateBody(GenerateOpportunitiesSchema), async (req: AuthRequest, res) => {
  try {
    const { model } = req.body ?? {};
    const report = await generateOpportunities(supabase, { companyId: req.companyId!, model });
    res.json({ success: true, data: report });
  } catch (error) {
    logger.error({ err: error }, 'Error generating opportunities');
    res.status(500).json({ error: 'Failed to generate opportunities' });
  }
});

app.get('/api/opportunities', requireAuth, resolveCompanyMiddleware, async (req: AuthRequest, res) => {
  try {
    const report = await getOpportunityDashboard(supabase, req.companyId!);
    res.json({ success: true, data: report });
  } catch (error) {
    logger.error({ err: error }, 'Error fetching opportunities');
    res.status(500).json({ error: 'Failed to fetch opportunities' });
  }
});

app.get('/api/opportunities/:opportunityId', requireAuth, async (req: AuthRequest, res) => {
  try {
    const opportunityId = req.params["opportunityId"] as string;
    const result = await getOpportunityCustomers(supabase, opportunityId);
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error({ err: error }, 'Error fetching opportunity details');
    res.status(500).json({ error: 'Failed to fetch opportunity details' });
  }
});

app.post('/api/opportunities/:id/refine', requireAuth, validateBody(RefineOpportunitySchema), async (req: AuthRequest, res) => {
  try {
    const id = req.params["id"] as string;
    const { modifier } = req.body;

    const opportunity = await refineOpportunity(supabase, id, modifier.trim());
    res.json({ success: true, data: opportunity });
  } catch (error) {
    logger.error({ err: error }, 'Error refining opportunity');
    res.status(500).json({ error: 'Failed to refine opportunity', details: error instanceof Error ? error.message : String(error) });
  }
});

app.post('/api/opportunities/create-from-goal', requireAuth, resolveCompanyMiddleware, llmLimiter, validateBody(CreateOpportunityFromGoalSchema), async (req: AuthRequest, res) => {
  try {
    const { goal, model } = req.body;

    const opportunity = await createOpportunityFromGoal(supabase, goal.trim(), { companyId: req.companyId!, model });
    res.json({ success: true, data: opportunity });
  } catch (error) {
    logger.error({ err: error }, 'Error creating opportunity from goal');
    res.status(500).json({ error: 'Failed to create opportunity from goal', details: error instanceof Error ? error.message : String(error) });
  }
});

app.get('/api/personas', requireAuth, resolveCompanyMiddleware, async (req: AuthRequest, res) => {
  try {
    const distribution = await getPersonaDistribution(supabase, req.companyId!);
    res.json({ success: true, data: distribution });
  } catch (error) {
    logger.error({ err: error }, 'Error fetching personas');
    res.status(500).json({ error: 'Failed to fetch personas' });
  }
});

app.get('/api/personas/:personaName', requireAuth, resolveCompanyMiddleware, async (req: AuthRequest, res) => {
  try {
    const personaName = decodeURIComponent(req.params["personaName"] as string);
    const result = await getPersonaCustomers(supabase, personaName, req.companyId!);
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error({ err: error }, 'Error fetching persona customers');
    res.status(500).json({ error: 'Failed to fetch persona customers' });
  }
});

// ============================================
// CAMPAIGNS
// ============================================

// POST /api/campaigns/generate
app.post('/api/campaigns/generate', requireAuth, resolveCompanyMiddleware, llmLimiter, validateBody(GenerateCampaignSchema), async (req: AuthRequest, res) => {
  try {
    const { opportunityId, model } = req.body;
    const result = await generateCampaign(supabase, { opportunityId, companyId: req.companyId!, model });
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error({ err: error }, 'Error generating campaign');
    res.status(500).json({ error: 'Failed to generate campaign' });
  }
});

// POST /api/campaigns
app.post('/api/campaigns', requireAuth, resolveCompanyMiddleware, validateBody(SaveCampaignSchema), async (req: AuthRequest, res) => {
  try {
    const { opportunityId, campaign } = req.body ?? {};

    if (!opportunityId || !campaign) {
      return res.status(400).json({ error: 'opportunityId and campaign are required' });
    }

    const result = await saveCampaign(supabase, opportunityId, campaign, req.companyId!);
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error({ err: error }, 'Error saving campaign');
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to save campaign' });
  }
});

// GET /api/campaigns
app.get('/api/campaigns', requireAuth, resolveCompanyMiddleware, async (req: AuthRequest, res) => {
  try {
    const page = Math.max(1, parseInt(req.query["page"] as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query["limit"] as string) || 20));
    const { data, total } = await getCampaigns(supabase, req.companyId!, { page, limit });
    res.json({ success: true, data, meta: { page, limit, total, pages: Math.ceil(total / limit) } });
  } catch (error) {
    logger.error({ err: error }, 'Error fetching campaigns');
    res.status(500).json({ error: 'Failed to fetch campaigns' });
  }
});

// GET /api/campaigns/:id
app.get('/api/campaigns/:id', requireAuth, async (req: AuthRequest, res) => {
  try {
    const id = req.params["id"] as string;
    const campaign = await getCampaignById(supabase, id);
    res.json({ success: true, data: campaign });
  } catch (error) {
    logger.error({ err: error }, 'Error fetching campaign');
    res.status(500).json({ error: 'Failed to fetch campaign' });
  }
});

// GET /api/campaigns/:id/analytics
app.get('/api/campaigns/:id/analytics', requireAuth, async (req: AuthRequest, res) => {
  try {
    const id = req.params["id"] as string;
    const analytics = await getCampaignAnalytics(supabase, id);
    res.json({ success: true, data: analytics });
  } catch (error) {
    logger.error({ err: error }, 'Error fetching campaign analytics');
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to fetch campaign analytics' });
  }
});

// POST /api/campaigns/:id/refine
app.post('/api/campaigns/:id/refine', requireAuth, validateBody(RefineCampaignSchema), async (req: AuthRequest, res) => {
  try {
    const id = req.params["id"] as string;
    const { modifier, channel } = req.body;

    const result = await refineCampaignMessage(supabase, id, modifier, channel ?? undefined);
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error({ err: error }, 'Error refining campaign message');
    res.status(500).json({ error: 'Failed to refine campaign message', details: error instanceof Error ? error.message : String(error) });
  }
});

// POST /api/campaigns/:id/approve
app.post('/api/campaigns/:id/approve', requireAuth, async (req: AuthRequest, res) => {
  try {
    const id = req.params["id"] as string;
    const campaign = await approveCampaign(supabase, id);
    res.json({ success: true, data: campaign });
  } catch (error) {
    logger.error({ err: error }, 'Error approving campaign');
    res.status(500).json({ error: 'Failed to approve campaign' });
  }
});

// POST /api/campaigns/:id/launch
app.post('/api/campaigns/:id/launch', requireAuth, async (req: AuthRequest, res) => {
  try {
    const id = req.params["id"] as string;
    const result = await launchCampaign(supabase, id);
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error({ err: error }, 'Error launching campaign');
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to launch campaign' });
  }
});

// ============================================
// WEBHOOKS
// ============================================

// POST /api/webhooks/channel-status
app.post('/api/webhooks/channel-status', async (req, res) => {
  try {
    const signature = req.headers['x-signature'] as string;

    if (!signature) {
      return res.status(401).json({ error: 'Missing X-Signature header' });
    }

    // Verify signature
    const payload = JSON.stringify(req.body);
    const isValid = verifySignature(payload, signature);

    if (!isValid) {
      logger.warn('Webhook invalid signature received');
      return res.status(401).json({ error: 'Invalid signature' });
    }

    // Process webhook
    const event = req.body as WebhookEvent;
    const result = await processWebhook(supabase, event);

    res.json(result);
  } catch (error) {
    logger.error({ err: error }, 'Webhook processing error');
    res.status(500).json({ error: 'Failed to process webhook' });
  }
});

// ============================================
// ANALYTICS
// ============================================

const ANALYTICS_TTL = 5 * 60 * 1000; // 5 minutes

// GET /api/analytics/intelligence-brief
app.get('/api/analytics/intelligence-brief', requireAuth, resolveCompanyMiddleware, async (req: AuthRequest, res) => {
  try {
    const key = `intelligence-brief:${req.companyId}`;
    const cached = getCached<unknown>(key);
    if (cached) return res.json({ success: true, data: cached, cached: true });
    const brief = await generateIntelligenceBrief(supabase, req.companyId!);
    setCached(key, brief, ANALYTICS_TTL);
    res.json({ success: true, data: brief });
  } catch (error) {
    logger.error({ err: error }, 'Error generating intelligence brief');
    res.status(500).json({ error: 'Failed to generate intelligence brief' });
  }
});

// GET /api/analytics/campaign-funnel
app.get('/api/analytics/campaign-funnel', requireAuth, resolveCompanyMiddleware, async (req: AuthRequest, res) => {
  try {
    const key = `campaign-funnel:${req.companyId}`;
    const cached = getCached<unknown>(key);
    if (cached) return res.json({ success: true, data: cached, cached: true });
    const funnel = await getCampaignFunnel(supabase, req.companyId!);
    setCached(key, funnel, ANALYTICS_TTL);
    res.json({ success: true, data: funnel });
  } catch (error) {
    logger.error({ err: error }, 'Error fetching campaign funnel');
    res.status(500).json({ error: 'Failed to fetch campaign funnel' });
  }
});

// GET /api/analytics/opportunity-pipeline
app.get('/api/analytics/opportunity-pipeline', requireAuth, resolveCompanyMiddleware, async (req: AuthRequest, res) => {
  try {
    const key = `opportunity-pipeline:${req.companyId}`;
    const cached = getCached<unknown>(key);
    if (cached) return res.json({ success: true, data: cached, cached: true });
    const pipeline = await getOpportunityPipeline(supabase, req.companyId!);
    setCached(key, pipeline, ANALYTICS_TTL);
    res.json({ success: true, data: pipeline });
  } catch (error) {
    logger.error({ err: error }, 'Error fetching opportunity pipeline');
    res.status(500).json({ error: 'Failed to fetch opportunity pipeline' });
  }
});

// GET /api/analytics/channel-performance
app.get('/api/analytics/channel-performance', requireAuth, resolveCompanyMiddleware, async (req: AuthRequest, res) => {
  try {
    const key = `channel-performance:${req.companyId}`;
    const cached = getCached<unknown>(key);
    if (cached) return res.json({ success: true, data: cached, cached: true });
    const performance = await getChannelPerformance(supabase, req.companyId!);
    setCached(key, performance, ANALYTICS_TTL);
    res.json({ success: true, data: performance });
  } catch (error) {
    logger.error({ err: error }, 'Error fetching channel performance');
    res.status(500).json({ error: 'Failed to fetch channel performance' });
  }
});

// GET /api/analytics/opportunity-distribution
app.get('/api/analytics/opportunity-distribution', requireAuth, resolveCompanyMiddleware, async (req: AuthRequest, res) => {
  try {
    const key = `opportunity-distribution:${req.companyId}`;
    const cached = getCached<unknown>(key);
    if (cached) return res.json({ success: true, data: cached, cached: true });
    const distribution = await getOpportunityDistribution(supabase, req.companyId!);
    setCached(key, distribution, ANALYTICS_TTL);
    res.json({ success: true, data: distribution });
  } catch (error) {
    logger.error({ err: error }, 'Error fetching opportunity distribution');
    res.status(500).json({ error: 'Failed to fetch opportunity distribution' });
  }
});

// GET /api/analytics/opportunity-trend
app.get('/api/analytics/opportunity-trend', requireAuth, resolveCompanyMiddleware, async (req: AuthRequest, res) => {
  try {
    const days = req.query.days ? parseInt(req.query.days as string) : 30;
    const key = `opportunity-trend:${req.companyId}:${days}`;
    const cached = getCached<unknown>(key);
    if (cached) return res.json({ success: true, data: cached, cached: true });
    const trend = await getOpportunityTrend(supabase, days, req.companyId!);
    setCached(key, trend, ANALYTICS_TTL);
    res.json({ success: true, data: trend });
  } catch (error) {
    logger.error({ err: error }, 'Error fetching opportunity trend');
    res.status(500).json({ error: 'Failed to fetch opportunity trend' });
  }
});

// GET /api/analytics/activity-feed
app.get('/api/analytics/activity-feed', requireAuth, resolveCompanyMiddleware, async (req: AuthRequest, res) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;
    const key = `activity-feed:${req.companyId}:${limit}`;
    const cached = getCached<unknown>(key);
    if (cached) return res.json({ success: true, data: cached, cached: true });
    const feed = await getActivityFeed(supabase, limit, req.companyId!);
    setCached(key, feed, ANALYTICS_TTL);
    res.json({ success: true, data: feed });
  } catch (error) {
    logger.error({ err: error }, 'Error fetching activity feed');
    res.status(500).json({ error: 'Failed to fetch activity feed' });
  }
});

// GET /api/analytics/recommended-actions
app.get('/api/analytics/recommended-actions', requireAuth, resolveCompanyMiddleware, async (req: AuthRequest, res) => {
  try {
    const key = `recommended-actions:${req.companyId}`;
    const cached = getCached<unknown>(key);
    if (cached) return res.json({ success: true, data: cached, cached: true });
    const actions = await getRecommendedActions(supabase, req.companyId!);
    setCached(key, actions, ANALYTICS_TTL);
    res.json({ success: true, data: actions });
  } catch (error) {
    logger.error({ err: error }, 'Error fetching recommended actions');
    res.status(500).json({ error: 'Failed to fetch recommended actions' });
  }
});

// ============================================
// AI AGENTS
// ============================================

// POST /api/agents
app.post('/api/agents', requireAuth, resolveCompanyMiddleware, validateBody(CreateAgentSchema), async (req: AuthRequest, res) => {
  try {
    const { goal, guardrails } = req.body;

    const agent = await prisma.agent.create({
      data: {
        companyId: req.companyId!,
        name: `${goal.substring(0, 30)} Agent`,
        goal,
        status: 'discovering',
        guardrails: guardrails || { max_budget: 50000, frequency_cap: 3, channels: ['whatsapp', 'email'] },
        performance: { revenue: 0, conversion_rate: 0, customers_reached: 0 },
      },
    });

    agentOrchestrator.runAgentOnce(agent.id).catch(err => {
      logger.error({ err, agentId: agent.id }, 'Error running agent');
    });

    res.json({ success: true, data: agent });
  } catch (error) {
    logger.error({ err: error }, 'Error creating agent');
    res.status(500).json({ error: 'Failed to create agent' });
  }
});

// GET /api/agents
app.get('/api/agents', requireAuth, resolveCompanyMiddleware, async (req: AuthRequest, res) => {
  try {
    const page = Math.max(1, parseInt(req.query["page"] as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query["limit"] as string) || 20));
    const where = { companyId: req.companyId! };
    const [agents, total] = await Promise.all([
      prisma.agent.findMany({
        where,
        include: { _count: { select: { opportunities: true, campaigns: true, actions: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.agent.count({ where }),
    ]);
    res.json({ success: true, data: agents, meta: { page, limit, total, pages: Math.ceil(total / limit) } });
  } catch (error) {
    logger.error({ err: error }, 'Error fetching agents');
    res.status(500).json({ error: 'Failed to fetch agents' });
  }
});

// GET /api/agents/:id
app.get('/api/agents/:id', requireAuth, async (req: AuthRequest, res) => {
  try {
    const id = req.params["id"] as string;
    const agent = await prisma.agent.findUnique({
      where: { id },
      include: {
        opportunities: { orderBy: { createdAt: 'desc' }, take: 10 },
        campaigns: { orderBy: { createdAt: 'desc' }, take: 10 },
        actions: { orderBy: { createdAt: 'desc' }, take: 20 },
      },
    });

    if (!agent) return res.status(404).json({ error: 'Agent not found' });
    res.json({ success: true, data: agent });
  } catch (error) {
    logger.error({ err: error }, 'Error fetching agent');
    res.status(500).json({ error: 'Failed to fetch agent' });
  }
});

// POST /api/agents/:id/run
app.post('/api/agents/:id/run', requireAuth, async (req: AuthRequest, res) => {
  try {
    const id = req.params["id"] as string;
    await agentOrchestrator.runAgentOnce(id);
    res.json({ success: true, message: 'Agent execution triggered' });
  } catch (error) {
    logger.error({ err: error }, 'Error running agent');
    res.status(500).json({ error: 'Failed to run agent' });
  }
});

// PATCH /api/agents/:id
app.patch('/api/agents/:id', requireAuth, validateBody(PatchAgentSchema), async (req: AuthRequest, res) => {
  try {
    const id = req.params["id"] as string;
    const { status, guardrails } = req.body;
    const agent = await prisma.agent.update({
      where: { id },
      data: { status: status || undefined, guardrails: guardrails || undefined },
    });
    res.json({ success: true, data: agent });
  } catch (error) {
    logger.error({ err: error }, 'Error updating agent');
    res.status(500).json({ error: 'Failed to update agent' });
  }
});

// GET /api/activity-stream
app.get('/api/activity-stream', requireAuth, resolveCompanyMiddleware, async (req: AuthRequest, res) => {
  try {
    const page = Math.max(1, parseInt(req.query["page"] as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query["limit"] as string) || 50));
    const actions = await getRecentActions(req.companyId!, limit, page);
    res.json({ success: true, data: actions });
  } catch (error) {
    logger.error({ err: error }, 'Error fetching activity stream');
    res.status(500).json({ error: 'Failed to fetch activity stream' });
  }
});

// Centralized error handler — must be registered after all routes
app.use(errorHandler);

export { app };

if (require.main === module) {
  const PORT = process.env.PORT || 3001;
  app.listen(Number(PORT), '0.0.0.0', () => {
    logger.info({ port: PORT }, 'Backend server started');
    startWorkers();
    agentOrchestrator.start(21600000); // 6 hours — preserves free-tier quota
    logger.info('Agent Orchestrator started');
  });
}

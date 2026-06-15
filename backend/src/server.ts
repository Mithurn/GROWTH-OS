import { randomUUID } from 'crypto';
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import csvParser from 'csv-parser';
import { createClient } from '@supabase/supabase-js';
import { Readable } from 'stream';
import WebSocket from 'ws';
import 'dotenv/config';
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
import { prisma } from './lib/prisma';
import { startConversation, sendMessage, getConversation } from './services/onboarding-chat';

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

// Middleware
app.use(cors());
app.use(express.json());

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

// In-memory storage for ingestion status
const ingestionStatus: Record<string, any> = {};

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

// GET /api/companies/:id
app.get('/api/companies/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from('companies')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      throw error;
    }

    res.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error('Error fetching company:', error);
    res.status(500).json({ error: 'Failed to fetch company' });
  }
});

// POST /api/onboarding/business
app.post('/api/onboarding/business', async (req, res) => {
  try {
    const { companyName, industry } = req.body;

    const { data, error } = await supabase
      .from('companies')
      .upsert(
        {
          company_name: companyName,
          industry,
        },
        { onConflict: 'company_name' },
      )
      .select('id, company_name, industry')
      .single();

    if (error) {
      throw error;
    }

    res.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error('Error saving business info:', error);
    res.status(500).json({ error: 'Failed to save business info' });
  }
});

// POST /api/onboarding/profile
app.post('/api/onboarding/profile', async (req, res) => {
  try {
    const {
      companyId,
      profile,
    } = req.body ?? {};

    if (!companyId || typeof companyId !== 'string') {
      return res.status(400).json({ error: 'companyId is required' });
    }

    if (!profile || typeof profile !== 'object') {
      return res.status(400).json({ error: 'profile is required' });
    }

    const { data, error } = await supabase
      .from('companies')
      .update({
        onboarding_profile: profile,
        onboarding_completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', companyId)
      .select('id, company_name, industry, onboarding_profile, onboarding_completed_at')
      .single();

    if (error) {
      throw error;
    }

    res.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error('Error saving onboarding profile:', error);
    res.status(500).json({ error: 'Failed to save onboarding profile' });
  }
});

// POST /api/onboarding/conversation/start
app.post('/api/onboarding/conversation/start', async (req, res) => {
  try {
    const { companyId } = req.body;

    if (!companyId) {
      return res.status(400).json({ error: 'companyId is required' });
    }

    const conversation = await startConversation(supabase, companyId);

    res.json({
      success: true,
      data: conversation,
    });
  } catch (error) {
    console.error('Error starting conversation:', error);
    res.status(500).json({ error: 'Failed to start conversation' });
  }
});

// POST /api/onboarding/conversation/:id/message
app.post('/api/onboarding/conversation/:id/message', async (req, res) => {
  try {
    const { id } = req.params;
    const { message } = req.body;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'message is required' });
    }

    const conversation = await sendMessage(supabase, id, message);

    res.json({
      success: true,
      data: conversation,
    });
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// GET /api/onboarding/conversation/:id
app.get('/api/onboarding/conversation/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const conversation = await getConversation(supabase, id);

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    res.json({
      success: true,
      data: conversation,
    });
  } catch (error) {
    console.error('Error fetching conversation:', error);
    res.status(500).json({ error: 'Failed to fetch conversation' });
  }
});

// POST /api/onboarding/complete
app.post('/api/onboarding/complete', async (req, res) => {
  try {
    const { conversationId, companyId } = req.body;

    if (!conversationId || !companyId) {
      return res.status(400).json({ error: 'conversationId and companyId are required' });
    }

    // Get the completed conversation
    const conversation = await getConversation(supabase, conversationId);

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    if (!conversation.completed) {
      return res.status(400).json({ error: 'Conversation not completed yet' });
    }

    const extractedData = conversation.extractedData;

    // Save onboarding profile to company
    const { data: company, error: companyError } = await supabase
      .from('companies')
      .update({
        onboarding_profile: extractedData,
        onboarding_completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', companyId)
      .select()
      .single();

    if (companyError) {
      throw companyError;
    }

    // Create an agent with the user's preferences
    const priority = extractedData.priority?.[0] || 'Increase revenue';
    const channels = extractedData.channels || ['WhatsApp', 'Email'];
    const involvement = extractedData.involvement?.[0] || 'review major campaigns only';

    // Create agent using Prisma
    const agent = await prisma.agent.create({
      data: {
        companyId,
        name: `${priority} Agent`,
        goal: priority,
        status: 'discovering',
        guardrails: {
          channels,
          involvement, // 'autopilot', 'review major campaigns only', or 'review every campaign'
          max_budget: 100000,
          frequency_cap: 3,
        },
      },
    });

    console.log(`✅ Created agent for company ${companyId}: ${agent.name}`);

    res.json({
      success: true,
      data: {
        company,
        agent,
      },
    });
  } catch (error) {
    console.error('Error completing onboarding:', error);
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
    console.error('Error parsing customer CSV:', error);
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
    console.error('Error parsing orders CSV:', error);
    res.status(500).json({ error: 'Failed to parse orders CSV' });
  }
});

// POST /api/process-ingestion
app.post('/api/process-ingestion', upload.fields([
  { name: 'customers', maxCount: 1 },
  { name: 'orders', maxCount: 1 }
]), async (req, res) => {
  const sessionId = Date.now().toString();

  try {
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };

    if (!files.customers || !files.orders) {
      return res.status(400).json({ error: 'Both customer and order files required' });
    }

    // Initialize status
    ingestionStatus[sessionId] = {
      step: 'validating',
      progress: 0,
      message: 'Starting ingestion...'
    };

    // Start async processing
    processIngestion(sessionId, files.customers[0].buffer, files.orders[0].buffer);

    res.json({ success: true, sessionId });
  } catch (error) {
    console.error('Error starting ingestion:', error);
    res.status(500).json({ error: 'Failed to start ingestion' });
  }
});

// GET /api/ingestion-status/:sessionId
app.get('/api/ingestion-status/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  const status = ingestionStatus[sessionId] || { step: 'not_found', progress: 0 };
  res.json(status);
});

// Async ingestion process
async function processIngestion(sessionId: string, customerBuffer: Buffer, orderBuffer: Buffer) {
  try {
    // Step 1: Validate
    updateStatus(sessionId, 'validating', 10, 'Validating data...');
    await sleep(500);

    // Step 2: Parse CSVs
    updateStatus(sessionId, 'parsing', 20, 'Parsing CSV files...');
    const customers = await parseCSV(customerBuffer);
    const orders = await parseCSV(orderBuffer);

    // Step 3: Seed products (if not already seeded)
    updateStatus(sessionId, 'seeding_products', 30, 'Seeding products...');
    await seedProductsIfNeeded();

    // Step 4: Import customers
    updateStatus(sessionId, 'importing_customers', 40, 'Importing customers...');
    const customerMap = await importCustomers(customers);

    // Step 5: Import orders
    updateStatus(sessionId, 'importing_orders', 60, 'Importing orders and products...');
    const orderImportSummary = await importOrders(orders, customerMap);
    updateStatus(
      sessionId,
      'importing_orders',
      72,
      `Imported ${orderImportSummary.ordersInserted} orders and ${orderImportSummary.orderItemsInserted} order items...`,
    );

    // Step 6: Calculate metrics
    updateStatus(sessionId, 'calculating_metrics', 80, 'Calculating customer metrics...');
    const metricsReport = await generateCustomerMetricsWithVerification();
    updateStatus(
      sessionId,
      'validating_metrics',
      95,
      `Validated ${metricsReport.totalMetricsRecords}/${metricsReport.totalCustomers} customer metrics records...`,
    );

    // Step 7: Calculate attributes
    updateStatus(sessionId, 'calculating_attributes', 90, 'Calculating customer attributes...');
    const attributesReport = await generateCustomerAttributesWithVerification();
    updateStatus(
      sessionId,
      'validating_attributes',
      93,
      `Validated ${attributesReport.totalAttributesRecords}/${attributesReport.totalCustomers} customer attributes records...`,
    );

    // Step 7.5: Generate personas
    updateStatus(sessionId, 'generating_personas', 95, 'Generating customer personas with AI...');
    try {
      const personasReport = await generatePersonas(supabase, {
        logger: {
          info: (msg) => console.log(`[personas] ${msg}`),
          warn: (msg) => console.warn(`[personas] ${msg}`),
          error: (msg) => console.error(`[personas] ${msg}`),
        },
      });
      updateStatus(
        sessionId,
        'personas_complete',
        98,
        `Generated ${personasReport.totalPersonas} personas for ${personasReport.personasAssigned} customers...`,
      );
    } catch (personaError) {
      console.error('Persona generation failed, continuing with ingestion:', personaError);
      updateStatus(sessionId, 'personas_skipped', 98, 'Skipped persona generation (non-critical)');
    }

    // Step 8: Complete
    updateStatus(sessionId, 'completed', 100, 'Ingestion complete!');

  } catch (error) {
    console.error('Ingestion error:', error);
    updateStatus(sessionId, 'error', 0, `Error: ${error}`);
  }
}

function updateStatus(sessionId: string, step: string, progress: number, message: string) {
  ingestionStatus[sessionId] = { step, progress, message };
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function generateCustomerMetricsWithVerification() {
  const firstPass = await generateCustomerMetrics(supabase);

  if (firstPass.totalMetricsRecords >= firstPass.totalCustomers) {
    console.log(
      `[customer_metrics] Verified ${firstPass.totalMetricsRecords}/${firstPass.totalCustomers} records on first pass`,
    );
    return firstPass;
  }

  console.warn(
    `[customer_metrics] Incomplete metrics after first pass (${firstPass.totalMetricsRecords}/${firstPass.totalCustomers}), retrying once...`,
  );

  await sleep(1000);
  const secondPass = await generateCustomerMetrics(supabase);

  if (secondPass.totalMetricsRecords < secondPass.totalCustomers) {
    throw new Error(
      `Customer metrics still incomplete after retry: ${secondPass.totalMetricsRecords}/${secondPass.totalCustomers}`,
    );
  }

  console.log(
    `[customer_metrics] Verified ${secondPass.totalMetricsRecords}/${secondPass.totalCustomers} records after retry`,
  );
  return secondPass;
}

async function generateCustomerAttributesWithVerification() {
  const firstPass = await generateCustomerAttributes(supabase);

  if (firstPass.totalAttributesRecords >= firstPass.totalCustomers) {
    console.log(
      `[customer_attributes] Verified ${firstPass.totalAttributesRecords}/${firstPass.totalCustomers} records on first pass`,
    );
    return firstPass;
  }

  console.warn(
    `[customer_attributes] Incomplete attributes after first pass (${firstPass.totalAttributesRecords}/${firstPass.totalCustomers}), retrying once...`,
  );

  await sleep(1000);
  const secondPass = await generateCustomerAttributes(supabase);

  if (secondPass.totalAttributesRecords < secondPass.totalCustomers) {
    throw new Error(
      `Customer attributes still incomplete after retry: ${secondPass.totalAttributesRecords}/${secondPass.totalCustomers}`,
    );
  }

  console.log(
    `[customer_attributes] Verified ${secondPass.totalAttributesRecords}/${secondPass.totalCustomers} records after retry`,
  );
  return secondPass;
}

async function seedProductsIfNeeded() {
  // Check if products already exist
  const { count, error } = await supabase
    .from('products')
    .select('*', { count: 'exact', head: true });

  if (error) {
    throw new Error(`Failed to inspect products table: ${error.message}`);
  }

  if (count === 0) {
    const seeded = await seedProducts(supabase);

    if (!seeded || seeded.length === 0) {
      throw new Error('Product seeding returned no rows');
    }

    const { count: verifyCount, error: verifyError } = await supabase
      .from('products')
      .select('*', { count: 'exact', head: true });

    if (verifyError) {
      throw new Error(`Failed to verify seeded products: ${verifyError.message}`);
    }

    if ((verifyCount ?? 0) === 0) {
      throw new Error('Product seeding did not persist any rows');
    }

    console.log(`[products] Seeded ${verifyCount} products`);
  }
}

async function importCustomers(customers: any[]) {
  const customerMap = new Map<string, string>(); // external_id -> supabase_id

  // Insert in batches
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
        signup_date: c.signup_date
      })))
      .select('id, external_customer_id');

    if (error) throw error;

    // Map external_id to supabase id
    data.forEach((customer: any) => {
      customerMap.set(customer.external_customer_id, customer.id);
    });
  }

  return customerMap;
}

async function importOrders(orders: any[], customerMap: Map<string, string>) {
  const { data: products } = await supabase.from('products').select('id, sku');
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
    });

    for (const item of items) {
      const productId = productMap.get(item.product_sku);
      if (!productId) {
        console.warn(`[order_items] Unknown SKU ${item.product_sku} in order ${orderId}`);
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
      console.error(`[orders] Bulk insert error (chunk ${i / CHUNK}):`, error);
      skippedOrders += Math.min(CHUNK, ordersToInsert.length - i);
    } else {
      ordersInserted += Math.min(CHUNK, ordersToInsert.length - i);
    }
  }

  for (let i = 0; i < orderItemsToInsert.length; i += CHUNK) {
    const { error } = await supabase.from('order_items').insert(orderItemsToInsert.slice(i, i + CHUNK));
    if (error) {
      console.error(`[order_items] Bulk insert error (chunk ${i / CHUNK}):`, error);
    } else {
      orderItemsInserted += Math.min(CHUNK, orderItemsToInsert.length - i);
    }
  }

  console.log(
    `[orders] Imported ${ordersInserted} orders and ${orderItemsInserted} order items. ` +
      `Skipped ${skippedOrders} orders and ${skippedItems} line items.`,
  );

  return { ordersInserted, orderItemsInserted, skippedOrders, skippedItems };
}

// GET /api/intelligence-preview
app.get('/api/intelligence-preview', async (req, res) => {
  try {
    // Get total counts
    const { count: totalCustomers } = await supabase
      .from('customers')
      .select('*', { count: 'exact', head: true });

    const { count: totalOrders } = await supabase
      .from('orders')
      .select('*', { count: 'exact', head: true });

    // Get revenue
    const { data: revenueData } = await supabase
      .from('orders')
      .select('total_amount');

    const revenue = revenueData?.reduce((sum, o) => sum + parseFloat(o.total_amount.toString()), 0) || 0;
    const avgOrderValue = totalOrders ? revenue / totalOrders : 0;

    // Get customer health (mock for now - will be real in Phase 3)
    const active = Math.floor(totalCustomers! * 0.68);
    const dormant = Math.floor(totalCustomers! * 0.12);
    const atRisk = totalCustomers! - active - dormant;

    // Get top customers
    const { data: topCustomers } = await supabase
      .from('customer_metrics')
      .select('customer_id, total_spent, customers(first_name, last_name)')
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
        totalSpent: c.total_spent
      })) || []
    });
  } catch (error) {
    console.error('Error fetching intelligence:', error);
    res.status(500).json({ error: 'Failed to fetch intelligence' });
  }
});

app.post('/api/personas/generate', async (req, res) => {
  try {
    const { companyId, model } = req.body ?? {};
    const report = await generatePersonas(supabase, { companyId, model });

    res.json({
      success: true,
      data: report,
    });
  } catch (error) {
    console.error('Error generating personas:', error);
    res.status(500).json({ error: 'Failed to generate personas' });
  }
});

app.post('/api/opportunities/generate', async (req, res) => {
  try {
    const { companyId, model } = req.body ?? {};
    const report = await generateOpportunities(supabase, { companyId, model });

    res.json({
      success: true,
      data: report,
    });
  } catch (error) {
    console.error('Error generating opportunities:', error);
    res.status(500).json({ error: 'Failed to generate opportunities' });
  }
});

app.get('/api/opportunities', async (req, res) => {
  try {
    const companyId = typeof req.query.companyId === 'string' ? req.query.companyId : undefined;
    const report = await getOpportunityDashboard(supabase, companyId);

    res.json({
      success: true,
      data: report,
    });
  } catch (error) {
    console.error('Error fetching opportunities:', error);
    res.status(500).json({ error: 'Failed to fetch opportunities' });
  }
});

app.get('/api/opportunities/:opportunityId', async (req, res) => {
  try {
    const { opportunityId } = req.params;
    const result = await getOpportunityCustomers(supabase, opportunityId);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Error fetching opportunity details:', error);
    res.status(500).json({ error: 'Failed to fetch opportunity details' });
  }
});

app.post('/api/opportunities/:id/refine', async (req, res) => {
  try {
    const { id } = req.params;
    const { modifier } = req.body;

    if (!modifier || typeof modifier !== 'string' || modifier.trim().length === 0) {
      return res.status(400).json({ error: 'modifier is required and must be a non-empty string' });
    }

    const opportunity = await refineOpportunity(supabase, id, modifier.trim());

    res.json({
      success: true,
      data: opportunity,
    });
  } catch (error) {
    console.error('Error refining opportunity:', error);
    res.status(500).json({
      error: 'Failed to refine opportunity',
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

app.post('/api/opportunities/create-from-goal', async (req, res) => {
  try {
    const { goal, companyId, model } = req.body;

    if (!goal || typeof goal !== 'string' || goal.trim().length === 0) {
      return res.status(400).json({ error: 'Goal is required and must be a non-empty string' });
    }

    const opportunity = await createOpportunityFromGoal(supabase, goal.trim(), { companyId, model });

    res.json({
      success: true,
      data: opportunity,
    });
  } catch (error) {
    console.error('Error creating opportunity from goal:', error);
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    console.error('Error message:', error instanceof Error ? error.message : String(error));
    res.status(500).json({
      error: 'Failed to create opportunity from goal',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

app.get('/api/personas', async (req, res) => {
  try {
    const companyId = typeof req.query.companyId === 'string' ? req.query.companyId : undefined;
    const distribution = await getPersonaDistribution(supabase, companyId);

    res.json({
      success: true,
      data: distribution,
    });
  } catch (error) {
    console.error('Error fetching personas:', error);
    res.status(500).json({ error: 'Failed to fetch personas' });
  }
});

app.get('/api/personas/:personaName', async (req, res) => {
  try {
    const personaName = decodeURIComponent(req.params.personaName);
    const companyId = typeof req.query.companyId === 'string' ? req.query.companyId : undefined;
    const result = await getPersonaCustomers(supabase, personaName, companyId);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Error fetching persona customers:', error);
    res.status(500).json({ error: 'Failed to fetch persona customers' });
  }
});

// ============================================
// CAMPAIGNS
// ============================================

// POST /api/campaigns/generate
app.post('/api/campaigns/generate', async (req, res) => {
  try {
    const { opportunityId, companyId, model } = req.body ?? {};

    if (!opportunityId) {
      return res.status(400).json({ error: 'opportunityId is required' });
    }

    const result = await generateCampaign(supabase, { opportunityId, companyId, model });

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Error generating campaign:', error);
    res.status(500).json({ error: 'Failed to generate campaign' });
  }
});

// POST /api/campaigns
app.post('/api/campaigns', async (req, res) => {
  try {
    const { opportunityId, campaign, companyId } = req.body ?? {};

    if (!opportunityId || !campaign) {
      return res.status(400).json({ error: 'opportunityId and campaign are required' });
    }

    const result = await saveCampaign(supabase, opportunityId, campaign, companyId);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Error saving campaign:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to save campaign' });
  }
});

// GET /api/campaigns
app.get('/api/campaigns', async (req, res) => {
  try {
    const companyId = typeof req.query.companyId === 'string' ? req.query.companyId : undefined;
    const campaigns = await getCampaigns(supabase, companyId);

    res.json({
      success: true,
      data: campaigns,
    });
  } catch (error) {
    console.error('Error fetching campaigns:', error);
    res.status(500).json({ error: 'Failed to fetch campaigns' });
  }
});

// GET /api/campaigns/:id
app.get('/api/campaigns/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const campaign = await getCampaignById(supabase, id);

    res.json({
      success: true,
      data: campaign,
    });
  } catch (error) {
    console.error('Error fetching campaign:', error);
    res.status(500).json({ error: 'Failed to fetch campaign' });
  }
});

// GET /api/campaigns/:id/analytics
app.get('/api/campaigns/:id/analytics', async (req, res) => {
  try {
    const { id } = req.params;
    const analytics = await getCampaignAnalytics(supabase, id);
    res.json({ success: true, data: analytics });
  } catch (error) {
    console.error('Error fetching campaign analytics:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to fetch campaign analytics' });
  }
});

// POST /api/campaigns/:id/refine
app.post('/api/campaigns/:id/refine', async (req, res) => {
  try {
    const { id } = req.params;
    const { modifier = '', channel } = req.body ?? {};

    const result = await refineCampaignMessage(supabase, id, modifier, channel ?? undefined);

    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error refining campaign message:', error);
    res.status(500).json({
      error: 'Failed to refine campaign message',
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

// POST /api/campaigns/:id/approve
app.post('/api/campaigns/:id/approve', async (req, res) => {
  try {
    const { id } = req.params;
    const campaign = await approveCampaign(supabase, id);

    res.json({
      success: true,
      data: campaign,
    });
  } catch (error) {
    console.error('Error approving campaign:', error);
    res.status(500).json({ error: 'Failed to approve campaign' });
  }
});

// POST /api/campaigns/:id/launch
app.post('/api/campaigns/:id/launch', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await launchCampaign(supabase, id);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Error launching campaign:', error);
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
      console.warn('[Webhook] Invalid signature received');
      return res.status(401).json({ error: 'Invalid signature' });
    }

    // Process webhook
    const event = req.body as WebhookEvent;
    const result = await processWebhook(supabase, event);

    res.json(result);
  } catch (error) {
    console.error('[Webhook] Processing error:', error);
    res.status(500).json({ error: 'Failed to process webhook' });
  }
});

// ============================================
// ANALYTICS
// ============================================

// GET /api/analytics/intelligence-brief
app.get('/api/analytics/intelligence-brief', async (req, res) => {
  try {
    const companyId = typeof req.query.companyId === 'string' ? req.query.companyId : undefined;
    const brief = await generateIntelligenceBrief(supabase, companyId);

    res.json({
      success: true,
      data: brief,
    });
  } catch (error) {
    console.error('Error generating intelligence brief:', error);
    res.status(500).json({ error: 'Failed to generate intelligence brief' });
  }
});

// GET /api/analytics/campaign-funnel
app.get('/api/analytics/campaign-funnel', async (req, res) => {
  try {
    const funnel = await getCampaignFunnel(supabase);

    res.json({
      success: true,
      data: funnel,
    });
  } catch (error) {
    console.error('Error fetching campaign funnel:', error);
    res.status(500).json({ error: 'Failed to fetch campaign funnel' });
  }
});

// GET /api/analytics/opportunity-pipeline
app.get('/api/analytics/opportunity-pipeline', async (req, res) => {
  try {
    const pipeline = await getOpportunityPipeline(supabase);

    res.json({
      success: true,
      data: pipeline,
    });
  } catch (error) {
    console.error('Error fetching opportunity pipeline:', error);
    res.status(500).json({ error: 'Failed to fetch opportunity pipeline' });
  }
});

// GET /api/analytics/channel-performance
app.get('/api/analytics/channel-performance', async (req, res) => {
  try {
    const performance = await getChannelPerformance(supabase);

    res.json({
      success: true,
      data: performance,
    });
  } catch (error) {
    console.error('Error fetching channel performance:', error);
    res.status(500).json({ error: 'Failed to fetch channel performance' });
  }
});

// GET /api/analytics/opportunity-distribution
app.get('/api/analytics/opportunity-distribution', async (req, res) => {
  try {
    const distribution = await getOpportunityDistribution(supabase);

    res.json({
      success: true,
      data: distribution,
    });
  } catch (error) {
    console.error('Error fetching opportunity distribution:', error);
    res.status(500).json({ error: 'Failed to fetch opportunity distribution' });
  }
});

// GET /api/analytics/opportunity-trend
app.get('/api/analytics/opportunity-trend', async (req, res) => {
  try {
    const days = req.query.days ? parseInt(req.query.days as string) : 30;
    const trend = await getOpportunityTrend(supabase, days);

    res.json({
      success: true,
      data: trend,
    });
  } catch (error) {
    console.error('Error fetching opportunity trend:', error);
    res.status(500).json({ error: 'Failed to fetch opportunity trend' });
  }
});

// GET /api/analytics/activity-feed
app.get('/api/analytics/activity-feed', async (req, res) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;
    const feed = await getActivityFeed(supabase, limit);

    res.json({
      success: true,
      data: feed,
    });
  } catch (error) {
    console.error('Error fetching activity feed:', error);
    res.status(500).json({ error: 'Failed to fetch activity feed' });
  }
});

// GET /api/analytics/recommended-actions
app.get('/api/analytics/recommended-actions', async (req, res) => {
  try {
    const actions = await getRecommendedActions(supabase);

    res.json({
      success: true,
      data: actions,
    });
  } catch (error) {
    console.error('Error fetching recommended actions:', error);
    res.status(500).json({ error: 'Failed to fetch recommended actions' });
  }
});

// ============================================
// AI AGENTS
// ============================================

// POST /api/agents
app.post('/api/agents', async (req, res) => {
  try {
    const { companyId, goal, guardrails } = req.body;

    if (!companyId || !goal) {
      return res.status(400).json({ error: 'companyId and goal are required' });
    }

    // Create agent
    const agent = await prisma.agent.create({
      data: {
        companyId,
        name: `${goal.substring(0, 30)} Agent`,
        goal,
        status: 'discovering',
        guardrails: guardrails || {
          max_budget: 50000,
          frequency_cap: 3,
          channels: ['whatsapp', 'email']
        },
        performance: {
          revenue: 0,
          conversion_rate: 0,
          customers_reached: 0
        }
      }
    });

    // Trigger agent run immediately
    agentOrchestrator.runAgentOnce(agent.id).catch(err => {
      console.error('Error running agent:', err);
    });

    res.json({
      success: true,
      data: agent,
    });
  } catch (error) {
    console.error('Error creating agent:', error);
    res.status(500).json({ error: 'Failed to create agent' });
  }
});

// GET /api/agents
app.get('/api/agents', async (req, res) => {
  try {
    const companyId = typeof req.query.companyId === 'string' ? req.query.companyId : undefined;

    const agents = await prisma.agent.findMany({
      where: companyId ? { companyId } : {},
      include: {
        _count: {
          select: {
            opportunities: true,
            campaigns: true,
            actions: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    res.json({
      success: true,
      data: agents,
    });
  } catch (error) {
    console.error('Error fetching agents:', error);
    res.status(500).json({ error: 'Failed to fetch agents' });
  }
});

// GET /api/agents/:id
app.get('/api/agents/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const agent = await prisma.agent.findUnique({
      where: { id },
      include: {
        opportunities: {
          orderBy: { createdAt: 'desc' },
          take: 10
        },
        campaigns: {
          orderBy: { createdAt: 'desc' },
          take: 10
        },
        actions: {
          orderBy: { createdAt: 'desc' },
          take: 20
        }
      }
    });

    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    res.json({
      success: true,
      data: agent,
    });
  } catch (error) {
    console.error('Error fetching agent:', error);
    res.status(500).json({ error: 'Failed to fetch agent' });
  }
});

// POST /api/agents/:id/run
app.post('/api/agents/:id/run', async (req, res) => {
  try {
    const { id } = req.params;

    // Trigger manual agent run
    await agentOrchestrator.runAgentOnce(id);

    res.json({
      success: true,
      message: 'Agent execution triggered'
    });
  } catch (error) {
    console.error('Error running agent:', error);
    res.status(500).json({ error: 'Failed to run agent' });
  }
});

// PATCH /api/agents/:id
app.patch('/api/agents/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, guardrails } = req.body;

    const agent = await prisma.agent.update({
      where: { id },
      data: {
        status: status || undefined,
        guardrails: guardrails || undefined
      }
    });

    res.json({
      success: true,
      data: agent,
    });
  } catch (error) {
    console.error('Error updating agent:', error);
    res.status(500).json({ error: 'Failed to update agent' });
  }
});

// GET /api/activity-stream
app.get('/api/activity-stream', async (req, res) => {
  try {
    const companyId = typeof req.query.companyId === 'string' ? req.query.companyId : undefined;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;

    if (!companyId) {
      return res.status(400).json({ error: 'companyId is required' });
    }

    const actions = await getRecentActions(companyId, limit);

    res.json({
      success: true,
      data: actions,
    });
  } catch (error) {
    console.error('Error fetching activity stream:', error);
    res.status(500).json({ error: 'Failed to fetch activity stream' });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(Number(PORT), '0.0.0.0', () => {
  console.log(`🚀 Backend server running on http://0.0.0.0:${PORT}`);

  // Start the Agent Orchestrator
  // Run every 5 minutes (300000ms) in production
  // For demo/testing, you can set this to 60000ms (1 minute)
  agentOrchestrator.start(300000);
  console.log('🤖 Agent Orchestrator started');
});

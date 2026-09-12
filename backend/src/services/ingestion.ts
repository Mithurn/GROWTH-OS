import { randomUUID } from 'crypto';
import { Readable } from 'stream';
import csvParser from 'csv-parser';
import { supabase } from '../lib/supabase';
import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';
import { generateCustomerAttributes } from './customer-attributes';
import { generateCustomerMetrics } from './customer-metrics';
import { generatePersonas } from './personas';

/** Supabase rejects very large request bodies, so bulk inserts are chunked. */
const INSERT_CHUNK_SIZE = 1000;
const CUSTOMER_BATCH_SIZE = 100;

export interface OrderImportSummary {
  ordersInserted: number;
  orderItemsInserted: number;
  skippedOrders: number;
  skippedItems: number;
}

export function parseCSV(buffer: Buffer): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const results: any[] = [];
    Readable.from(buffer)
      .pipe(csvParser())
      .on('data', (data) => results.push(data))
      .on('end', () => resolve(results))
      .on('error', reject);
  });
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function updateStatus(sessionId: string, step: string, progress: number) {
  await prisma.ingestionSession.update({
    where: { id: sessionId },
    data: { status: 'processing', step, progress },
  });
}

/**
 * Persist the CSVs and enqueue (or run) the pipeline. Callers return the session id
 * immediately; progress is on the row. Buffers live on the row so a spin-down can
 * resume the same session instead of leaving it stuck at "processing".
 */
export async function startIngestionJob(
  companyId: string,
  customerBuffer: Buffer,
  orderBuffer: Buffer,
): Promise<string> {
  const session = await prisma.ingestionSession.create({
    data: {
      companyId,
      status: 'pending',
      step: 'queued',
      progress: 0,
      customerCsv: Uint8Array.from(customerBuffer),
      orderCsv: Uint8Array.from(orderBuffer),
    },
  });

  const { enqueueIngestion } = await import('../lib/queues');
  await enqueueIngestion({ sessionId: session.id });
  return session.id;
}

/**
 * Run the full CSV → insight pipeline for one session.
 *
 * Reads the CSVs off the session row (not from memory) so a worker, an inline
 * fallback, or a boot-time resume all take the same path.
 */
export async function processIngestion(sessionId: string) {
  const session = await prisma.ingestionSession.findUnique({ where: { id: sessionId } });
  if (!session) {
    throw new Error(`Ingestion session ${sessionId} not found`);
  }
  if (!session.customerCsv || !session.orderCsv) {
    throw new Error(`Ingestion session ${sessionId} has no CSV payloads to process`);
  }

  const companyId = session.companyId;
  const customerBuffer = Buffer.from(session.customerCsv);
  const orderBuffer = Buffer.from(session.orderCsv);

  try {
    await updateStatus(sessionId, 'validating', 10);
    await sleep(500);

    await updateStatus(sessionId, 'parsing', 20);
    const customers = await parseCSV(customerBuffer);
    const orders = await parseCSV(orderBuffer);

    await updateStatus(sessionId, 'seeding_products', 30);
    await seedProductsFromCSV(companyId, orders);

    await updateStatus(sessionId, 'importing_customers', 40);
    const customerMap = await importCustomers(customers, companyId);

    await updateStatus(sessionId, 'importing_orders', 60);
    const orderImportSummary = await importOrders(orders, customerMap, companyId);
    logger.info({ sessionId, ...orderImportSummary }, 'Orders imported');
    await updateStatus(sessionId, 'importing_orders', 72);

    await updateStatus(sessionId, 'calculating_metrics', 80);
    const metricsReport = await generateCustomerMetricsWithVerification(companyId);
    logger.info(
      { sessionId, records: metricsReport.totalMetricsRecords, customers: metricsReport.totalCustomers },
      'Customer metrics validated',
    );
    await updateStatus(sessionId, 'validating_metrics', 85);

    await updateStatus(sessionId, 'calculating_attributes', 90);
    await generateCustomerAttributesWithVerification(companyId);

    // Mark complete immediately so the user can enter the dashboard. Drop the
    // CSV payloads — they were only needed to survive a crash mid-run.
    await prisma.ingestionSession.update({
      where: { id: sessionId },
      data: {
        status: 'complete',
        step: 'completed',
        progress: 100,
        customerCsv: null,
        orderCsv: null,
      },
    });

    // Personas take another LLM round-trip, so they run after the user is already in.
    generatePersonas(supabase, {
      companyId,
      logger: {
        info: (msg) => logger.info(msg),
        warn: (msg) => logger.warn(msg),
        error: (msg) => logger.error(msg),
      },
    }).catch((err) => logger.warn({ err }, 'Background persona generation failed'));
  } catch (error) {
    logger.error({ err: error, sessionId }, 'Ingestion error');
    await prisma.ingestionSession
      .update({
        where: { id: sessionId },
        data: {
          status: 'error',
          errorMessage: error instanceof Error ? error.message : String(error),
          progress: 0,
        },
      })
      .catch(() => {});
  }
}

/**
 * Metrics and attributes are derived in bulk, and a partial write leaves the whole
 * dashboard subtly wrong rather than visibly broken. Both are retried once and then
 * fail the session loudly instead of proceeding with incomplete data.
 */
async function generateCustomerMetricsWithVerification(companyId: string) {
  const firstPass = await generateCustomerMetrics(supabase, { companyId });
  if (firstPass.totalMetricsRecords >= firstPass.totalCustomers) return firstPass;

  logger.warn('customer_metrics incomplete after first pass, retrying...');
  await sleep(1000);
  const secondPass = await generateCustomerMetrics(supabase, { companyId });
  if (secondPass.totalMetricsRecords < secondPass.totalCustomers) {
    throw new Error(
      `Customer metrics incomplete after retry: ${secondPass.totalMetricsRecords}/${secondPass.totalCustomers}`,
    );
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
    throw new Error(
      `Customer attributes incomplete after retry: ${secondPass.totalAttributesRecords}/${secondPass.totalCustomers}`,
    );
  }
  return secondPass;
}

/**
 * Derive the product catalog from the order rows themselves, scoped to the company.
 * Replaces a global product seed, so each company owns its own catalog.
 */
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

/**
 * Returns a map of the CSV's `customer_id` to the row id Postgres assigned.
 *
 * Upserts rather than inserts so an import can be re-run — retrying after a partial
 * failure, or re-uploading a corrected export, used to duplicate every customer.
 * Keyed on the compound unique `(company_id, external_customer_id)`.
 */
async function importCustomers(customers: any[], companyId: string) {
  const customerMap = new Map<string, string>();

  for (let i = 0; i < customers.length; i += CUSTOMER_BATCH_SIZE) {
    const batch = customers.slice(i, i + CUSTOMER_BATCH_SIZE);

    const { data, error } = await supabase
      .from('customers')
      .upsert(
        batch.map((c) => ({
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
        })),
        { onConflict: 'company_id,external_customer_id' },
      )
      .select('id, external_customer_id');

    if (error) throw error;

    data.forEach((customer: any) => {
      customerMap.set(customer.external_customer_id, customer.id);
    });
  }

  return customerMap;
}

async function importOrders(
  orders: any[],
  customerMap: Map<string, string>,
  companyId: string,
): Promise<OrderImportSummary> {
  const { data: products } = await supabase
    .from('products')
    .select('id, sku')
    .eq('company_id', companyId);
  const productMap = new Map(products?.map((p) => [p.sku, p.id]) || []);

  if (productMap.size === 0) {
    throw new Error('No products available for order item import');
  }

  // One CSV row is one line item, so rows have to be regrouped into orders.
  const orderGroups = new Map<string, any[]>();
  orders.forEach((o) => {
    if (!orderGroups.has(o.order_id)) orderGroups.set(o.order_id, []);
    orderGroups.get(o.order_id)!.push(o);
  });

  // Generate the order ids client-side so orders and their items can both be
  // bulk-inserted without a round-trip to read back DB-assigned ids.
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
    if (!customerId) {
      skippedOrders++;
      continue;
    }

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

  let ordersInserted = 0;
  let orderItemsInserted = 0;

  for (let i = 0; i < ordersToInsert.length; i += INSERT_CHUNK_SIZE) {
    const chunk = ordersToInsert.slice(i, i + INSERT_CHUNK_SIZE);
    const { error } = await supabase.from('orders').insert(chunk);
    if (error) {
      logger.error({ err: error, offset: i }, 'Orders bulk insert error');
      skippedOrders += chunk.length;
    } else {
      ordersInserted += chunk.length;
    }
  }

  for (let i = 0; i < orderItemsToInsert.length; i += INSERT_CHUNK_SIZE) {
    const chunk = orderItemsToInsert.slice(i, i + INSERT_CHUNK_SIZE);
    const { error } = await supabase.from('order_items').insert(chunk);
    if (error) {
      logger.error({ err: error, offset: i }, 'Order items bulk insert error');
      skippedItems += chunk.length;
    } else {
      orderItemsInserted += chunk.length;
    }
  }

  logger.info(
    { ordersInserted, orderItemsInserted, skippedOrders, skippedItems },
    'Orders import complete',
  );

  return { ordersInserted, orderItemsInserted, skippedOrders, skippedItems };
}

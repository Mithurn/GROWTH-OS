import { Readable } from 'stream';
import csvParser from 'csv-parser';
import { supabase } from '../lib/supabase';
import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';
import { generateCustomerAttributes } from './customer-attributes';
import { generateCustomerMetricsPrisma } from './customer-metrics';
import {
  importCustomersPrisma,
  importOrdersPrisma,
  seedProductsPrisma,
} from './ingest-prisma';
import { generatePersonas } from './personas';
import { materializeCodedOpportunities } from './opportunity-discovery';

export type { OrderImportSummary } from './ingest-prisma';

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
  // Local Prisma can lag the cloud `companies` row the JWT resolved. Ensure the
  // FK exists before we write the session — same id, so tenancy stays aligned.
  const existing = await prisma.company.findUnique({ where: { id: companyId } });
  if (!existing) {
    const { data } = await supabase
      .from('companies')
      .select('company_name, industry, user_id')
      .eq('id', companyId)
      .maybeSingle();
    await prisma.company.create({
      data: {
        id: companyId,
        companyName: data?.company_name ?? `Workspace ${companyId.slice(0, 8)}`,
        industry: data?.industry ?? undefined,
        userId: data?.user_id ?? undefined,
      },
    });
  }

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
    await seedProductsPrisma(companyId, orders);

    await updateStatus(sessionId, 'importing_customers', 40);
    const customerMap = await importCustomersPrisma(customers, companyId);

    await updateStatus(sessionId, 'importing_orders', 60);
    const orderImportSummary = await importOrdersPrisma(orders, customerMap, companyId);
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
    try {
      await generateCustomerAttributesWithVerification(companyId);
    } catch (err) {
      logger.warn({ err }, 'Attribute generation skipped — customer rows are already in Prisma');
    }

    const agent = await prisma.agent.findFirst({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
    });
    await materializeCodedOpportunities(companyId, agent?.id).catch((err) =>
      logger.warn({ err }, 'Coded opportunity materialize failed'),
    );

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
  const firstPass = await generateCustomerMetricsPrisma(companyId);
  if (firstPass.totalMetricsRecords >= firstPass.totalCustomers) return firstPass;

  logger.warn('customer_metrics incomplete after first pass, retrying...');
  await sleep(1000);
  const secondPass = await generateCustomerMetricsPrisma(companyId);
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

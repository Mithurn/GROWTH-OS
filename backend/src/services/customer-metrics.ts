import type { SupabaseClient } from '@supabase/supabase-js';
import { prisma } from '../lib/prisma';
import { logger as rootLogger } from '../lib/logger';
import {
  toNumber,
  roundToTwo,
  daysSince as safeDaysSince,
  computeRfm,
  type CustomerAggregate,
} from '@growthos/domain';

export interface CustomerMetricsLogger {
  info: (message: string, ...args: unknown[]) => void;
  warn: (message: string, ...args: unknown[]) => void;
  error: (message: string, ...args: unknown[]) => void;
}

export interface CustomerMetricsRecord {
  customer_id: string;
  company_id?: string;
  total_orders: number;
  total_spent: number;
  avg_order_value: number;
  last_order_date: string | null;
  days_since_last_order: number | null;
  purchase_frequency: 'High' | 'Medium' | 'Low';
  engagement_score: number;
  updated_at?: string;
}

export interface CustomerMetricsReport {
  generatedAt: string;
  totalCustomers: number;
  totalOrders: number;
  totalMetricsRecords: number;
  zeroOrderCustomers: number;
  top10CustomersBySpend: CustomerMetricsRecord[];
  top10CustomersByOrderCount: CustomerMetricsRecord[];
  top10DormantCustomers: CustomerMetricsRecord[];
  sampleValidations: MetricsValidationResult[];
}

export interface MetricsValidationResult {
  customerId: string;
  customerName: string;
  rawOrderCount: number;
  rawTotalSpent: number;
  rawLastOrderDate: string | null;
  storedOrderCount: number;
  storedTotalSpent: number;
  storedLastOrderDate: string | null;
  matches: boolean;
}

interface CustomerRow {
  id: string;
  first_name: string;
  last_name: string | null;
}

interface OrderRow {
  customer_id: string;
  total_amount: number | string;
  order_date: string;
}

interface StoredMetricRow {
  customer_id: string;
  total_orders: number;
  total_spent: number | string;
  last_order_date: string | null;
}

interface GenerateCustomerMetricsOptions {
  batchSize?: number;
  logger?: CustomerMetricsLogger;
  companyId?: string;
}

const DEFAULT_BATCH_SIZE = 100;

const defaultLogger: CustomerMetricsLogger = {
  info:  (msg, ...args) => rootLogger.info(args[0] ?? {}, msg),
  warn:  (msg, ...args) => rootLogger.warn(args[0] ?? {}, msg),
  error: (msg, ...args) => rootLogger.error(args[0] ?? {}, msg),
};

function toISODate(value: Date | null): string | null {
  return value ? value.toISOString() : null;
}

function toDateKey(value: string | Date | null | undefined): string | null {
  if (value == null) {
    return null;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString().slice(0, 10);
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed.length >= 10) {
    return trimmed.slice(0, 10);
  }

  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
}

function aggregateOrdersByCustomer(orders: OrderRow[]): Map<string, CustomerAggregate> {
  const aggregates = new Map<string, CustomerAggregate>();

  for (const order of orders) {
    const customerId = order.customer_id;
    if (!customerId) continue;

    const totalAmount = toNumber(order.total_amount);
    const orderDate = new Date(order.order_date);
    if (Number.isNaN(orderDate.getTime())) continue;

    const existing = aggregates.get(customerId) ?? {
      totalOrders: 0,
      totalSpent: 0,
      lastOrderDate: null,
    };

    existing.totalOrders += 1;
    existing.totalSpent += totalAmount;

    if (!existing.lastOrderDate || orderDate > existing.lastOrderDate) {
      existing.lastOrderDate = orderDate;
    }

    aggregates.set(customerId, existing);
  }

  return aggregates;
}

function buildMetrics(customer: CustomerRow, aggregate: CustomerAggregate | undefined, now: Date): CustomerMetricsRecord {
  const rfm = computeRfm(aggregate, now);

  return {
    customer_id: customer.id,
    total_orders: rfm.totalOrders,
    total_spent: rfm.totalSpent,
    avg_order_value: rfm.avgOrderValue,
    last_order_date: toISODate(rfm.lastOrderDate),
    days_since_last_order: rfm.daysSinceLastOrder,
    purchase_frequency: rfm.purchaseFrequency,
    engagement_score: rfm.engagementScore,
    updated_at: now.toISOString(),
  };
}

function summarizeCustomer(customer: CustomerRow): string {
  const lastName = customer.last_name?.trim();
  return lastName ? `${customer.first_name} ${lastName}` : customer.first_name;
}

async function upsertInBatches(
  supabase: SupabaseClient,
  metrics: CustomerMetricsRecord[],
  batchSize: number,
  logger: CustomerMetricsLogger,
): Promise<void> {
  for (let index = 0; index < metrics.length; index += batchSize) {
    const batch = metrics.slice(index, index + batchSize);
    const batchNumber = Math.floor(index / batchSize) + 1;
    const totalBatches = Math.ceil(metrics.length / batchSize);

    logger.info(
      `[customer_metrics] Upserting batch ${batchNumber}/${totalBatches} (${batch.length} records)`,
    );

    for (const metric of batch) {
      const { error } = await supabase
        .from('customer_metrics')
        .upsert(metric, { onConflict: 'customer_id' });

      if (error) {
        logger.error('[customer_metrics] Failed metric payload:', metric);
        throw new Error(
          `Failed to upsert customer metrics for customer ${metric.customer_id}: ${error.message}`,
        );
      }
    }
  }
}

async function fetchMetricsCount(supabase: SupabaseClient): Promise<number> {
  const { count, error } = await supabase
    .from('customer_metrics')
    .select('id', { count: 'exact', head: true });

  if (error) {
    throw new Error(`Failed to count customer metrics: ${error.message}`);
  }

  return count ?? 0;
}

async function fetchRawOrdersForCustomer(
  supabase: SupabaseClient,
  customerId: string,
): Promise<OrderRow[]> {
  const { data, error } = await supabase
    .from('orders')
    .select('customer_id, total_amount, order_date')
    .eq('customer_id', customerId)
    .order('order_date', { ascending: true });

  if (error) {
    throw new Error(`Failed to load raw orders for customer ${customerId}: ${error.message}`);
  }

  return (data ?? []) as OrderRow[];
}

async function fetchStoredMetricForCustomer(
  supabase: SupabaseClient,
  customerId: string,
): Promise<StoredMetricRow | null> {
  const { data, error } = await supabase
    .from('customer_metrics')
    .select('customer_id, total_orders, total_spent, last_order_date')
    .eq('customer_id', customerId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load stored metric for customer ${customerId}: ${error.message}`);
  }

  return (data ?? null) as StoredMetricRow | null;
}

function compareMetricToRawOrders(
  customerId: string,
  rawOrders: OrderRow[],
  storedMetric: StoredMetricRow | null,
): MetricsValidationResult {
  const rawAggregate = aggregateOrdersByCustomer(rawOrders).get(customerId) ?? {
    totalOrders: 0,
    totalSpent: 0,
    lastOrderDate: null,
  };

  const rawTotalSpent = roundToTwo(rawAggregate.totalSpent);
  const rawLastOrderDate = toDateKey(rawAggregate.lastOrderDate);
  const storedTotalSpent = roundToTwo(toNumber(storedMetric?.total_spent));
  const storedLastOrderDate = toDateKey(storedMetric?.last_order_date);

  return {
    customerId,
    customerName: '',
    rawOrderCount: rawAggregate.totalOrders,
    rawTotalSpent,
    rawLastOrderDate,
    storedOrderCount: storedMetric?.total_orders ?? 0,
    storedTotalSpent,
    storedLastOrderDate,
    matches:
      storedMetric !== null &&
      rawAggregate.totalOrders === storedMetric.total_orders &&
      rawTotalSpent === storedTotalSpent &&
      rawLastOrderDate === storedLastOrderDate,
  };
}

function pickValidationCustomerIds(metrics: CustomerMetricsRecord[]): string[] {
  const selected: string[] = [];

  const addCandidate = (candidate?: CustomerMetricsRecord) => {
    if (!candidate) return;
    if (!selected.includes(candidate.customer_id)) {
      selected.push(candidate.customer_id);
    }
  };

  addCandidate(metrics[0]);
  addCandidate([...metrics].sort((a, b) => b.total_orders - a.total_orders)[0]);

  const zeroOrderCustomer = metrics.find((metric) => metric.total_orders === 0);
  if (zeroOrderCustomer) {
    addCandidate(zeroOrderCustomer);
  } else {
    addCandidate([...metrics].sort((a, b) => a.total_orders - b.total_orders)[0]);
  }

  return selected.slice(0, 3);
}

export async function generateCustomerMetrics(
  supabase: SupabaseClient,
  options: GenerateCustomerMetricsOptions = {},
): Promise<CustomerMetricsReport> {
  const logger = options.logger ?? defaultLogger;
  const batchSize = options.batchSize ?? DEFAULT_BATCH_SIZE;
  const { companyId } = options;
  const now = new Date();

  logger.info('[customer_metrics] Starting generation pipeline');

  let customersQuery = supabase.from('customers').select('id, first_name, last_name').order('created_at', { ascending: true });
  if (companyId) customersQuery = customersQuery.eq('company_id', companyId);
  const { data: customersData, error: customersError } = await customersQuery;

  if (customersError) {
    throw new Error(`Failed to load customers: ${customersError.message}`);
  }

  let ordersQuery = supabase.from('orders').select('customer_id, total_amount, order_date');
  if (companyId) ordersQuery = ordersQuery.eq('company_id', companyId);
  const { data: ordersData, error: ordersError } = await ordersQuery;

  if (ordersError) {
    throw new Error(`Failed to load orders: ${ordersError.message}`);
  }

  const customers = (customersData ?? []) as CustomerRow[];
  const orders = (ordersData ?? []) as OrderRow[];

  logger.info(
    `[customer_metrics] Loaded ${customers.length} customers and ${orders.length} orders`,
  );

  const orderAggregates = aggregateOrdersByCustomer(orders);
  const metrics = customers.map((customer) => ({
    ...buildMetrics(customer, orderAggregates.get(customer.id), now),
    ...(companyId ? { company_id: companyId } : {}),
  }));
  const zeroOrderCustomers = metrics.filter((metric) => metric.total_orders === 0).length;

  logger.info('[customer_metrics] Computed metrics for all customers');

  await upsertInBatches(supabase, metrics, batchSize, logger);

  const totalMetricsRecords = await fetchMetricsCount(supabase);

  const top10CustomersBySpend = [...metrics]
    .sort((a, b) => b.total_spent - a.total_spent || b.total_orders - a.total_orders)
    .slice(0, 10);

  const top10CustomersByOrderCount = [...metrics]
    .sort((a, b) => b.total_orders - a.total_orders || b.total_spent - a.total_spent)
    .slice(0, 10);

  const top10DormantCustomers = [...metrics]
    .sort((a, b) => {
      const aDormancy = a.days_since_last_order ?? Number.POSITIVE_INFINITY;
      const bDormancy = b.days_since_last_order ?? Number.POSITIVE_INFINITY;

      if (aDormancy !== bDormancy) {
        return bDormancy - aDormancy;
      }

      if (a.total_orders !== b.total_orders) {
        return a.total_orders - b.total_orders;
      }

      return b.total_spent - a.total_spent;
    })
    .slice(0, 10);

  const validationCustomerIds = pickValidationCustomerIds(metrics);
  const sampleValidations: MetricsValidationResult[] = [];

  for (const customerId of validationCustomerIds) {
    const customer = customers.find((row) => row.id === customerId);

    if (!customer) continue;

    const rawOrders = await fetchRawOrdersForCustomer(supabase, customerId);
    const storedMetric = await fetchStoredMetricForCustomer(supabase, customerId);
    const validation = compareMetricToRawOrders(customerId, rawOrders, storedMetric);
    validation.customerName = summarizeCustomer(customer);
    sampleValidations.push(validation);
  }

  for (const validation of sampleValidations) {
    if (validation.matches) {
      logger.info(
        `[customer_metrics] Validation passed for ${validation.customerName} (${validation.customerId})`,
      );
    } else {
      logger.warn(
        `[customer_metrics] Validation mismatch for ${validation.customerName} (${validation.customerId})`,
        validation,
      );
    }
  }

  logger.info(
    `[customer_metrics] Generation complete. customers=${customers.length}, metrics=${totalMetricsRecords}, zero_order_customers=${zeroOrderCustomers}`,
  );
  logger.info('[customer_metrics] Top 10 customers by spend:', top10CustomersBySpend);
  logger.info('[customer_metrics] Top 10 customers by order count:', top10CustomersByOrderCount);
  logger.info('[customer_metrics] Top 10 dormant customers:', top10DormantCustomers);

  return {
    generatedAt: now.toISOString(),
    totalCustomers: customers.length,
    totalOrders: orders.length,
    totalMetricsRecords,
    zeroOrderCustomers,
    top10CustomersBySpend,
    top10CustomersByOrderCount,
    top10DormantCustomers,
    sampleValidations,
  };
}

/** Same RFM math as the Supabase path, written to the Prisma DATABASE_URL. */
export async function generateCustomerMetricsPrisma(companyId: string): Promise<CustomerMetricsReport> {
  const now = new Date();
  const customers = await prisma.customer.findMany({
    where: { companyId },
    select: { id: true, firstName: true, lastName: true },
    orderBy: { createdAt: 'asc' },
  });
  const orders = await prisma.order.findMany({
    where: { customer: { companyId } },
    select: { customerId: true, totalAmount: true, orderDate: true },
  });

  const aggregates = aggregateOrdersByCustomer(
    orders.map((order) => ({
      customer_id: order.customerId,
      total_amount: Number(order.totalAmount),
      order_date: order.orderDate.toISOString(),
    })),
  );

  const metrics = customers.map((customer) =>
    buildMetrics(
      { id: customer.id, first_name: customer.firstName, last_name: customer.lastName },
      aggregates.get(customer.id),
      now,
    ),
  );

  for (const metric of metrics) {
    await prisma.customerMetrics.upsert({
      where: { customerId: metric.customer_id },
      create: {
        customerId: metric.customer_id,
        totalOrders: metric.total_orders,
        totalSpent: metric.total_spent,
        avgOrderValue: metric.avg_order_value,
        lastOrderDate: metric.last_order_date ? new Date(metric.last_order_date) : null,
        daysSinceLastOrder: metric.days_since_last_order,
        purchaseFrequency: metric.purchase_frequency,
        engagementScore: metric.engagement_score,
      },
      update: {
        totalOrders: metric.total_orders,
        totalSpent: metric.total_spent,
        avgOrderValue: metric.avg_order_value,
        lastOrderDate: metric.last_order_date ? new Date(metric.last_order_date) : null,
        daysSinceLastOrder: metric.days_since_last_order,
        purchaseFrequency: metric.purchase_frequency,
        engagementScore: metric.engagement_score,
      },
    });
  }

  const zeroOrderCustomers = metrics.filter((metric) => metric.total_orders === 0).length;
  return {
    generatedAt: now.toISOString(),
    totalCustomers: customers.length,
    totalOrders: orders.length,
    totalMetricsRecords: metrics.length,
    zeroOrderCustomers,
    top10CustomersBySpend: metrics.slice().sort((a, b) => b.total_spent - a.total_spent).slice(0, 10),
    top10CustomersByOrderCount: metrics.slice().sort((a, b) => b.total_orders - a.total_orders).slice(0, 10),
    top10DormantCustomers: [],
    sampleValidations: [],
  };
}

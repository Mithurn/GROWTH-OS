import { prisma } from '../lib/prisma';
import {
  toNumber,
  computeRfm,
  type CustomerAggregate,
} from '@growthos/domain';

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

function toISODate(value: Date | null): string | null {
  return value ? value.toISOString() : null;
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

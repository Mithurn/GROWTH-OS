import { randomUUID } from 'crypto';
import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';
import { generateCustomerMetricsPrisma } from './customer-metrics';

export interface OrderImportSummary {
  ordersInserted: number;
  orderItemsInserted: number;
  skippedOrders: number;
  skippedItems: number;
}

const CUSTOMER_BATCH_SIZE = 100;
const INSERT_CHUNK_SIZE = 1000;

type CsvRow = Record<string, unknown>;

export type CleanOrderRow = {
  orderId: string;
  customerExternalId: string;
  orderDate: Date;
  sku: string;
  amount: number;
  quantity: number;
  channel: string | null;
};

function text(value: unknown): string {
  return String(value ?? '').trim();
}

function validDate(value: unknown): Date | null {
  const raw = text(value);
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

function validAmount(value: unknown): number | null {
  const raw = text(value).replace(/,/g, '');
  if (!raw) return null;
  const amount = Number(raw);
  return Number.isFinite(amount) && amount >= 0 ? amount : null;
}

function validQuantity(value: unknown): number | null {
  const raw = text(value);
  if (!raw) return 1;
  const quantity = Number(raw);
  return Number.isInteger(quantity) && quantity > 0 ? quantity : null;
}

export function cleanOrderRow(row: CsvRow): CleanOrderRow | null {
  const orderId = text(row.order_id);
  const customerExternalId = text(row.customer_id);
  const orderDate = validDate(row.order_date);
  const sku = text(row.product_sku);
  const amount = validAmount(row.amount);
  const quantity = validQuantity(row.quantity);
  if (!orderId || !customerExternalId || !orderDate || !sku || amount === null || quantity === null) return null;
  return {
    orderId,
    customerExternalId,
    orderDate,
    sku,
    amount,
    quantity,
    channel: text(row.channel) || null,
  };
}

export function isConsentGranted(value: unknown): boolean {
  return value === true || ['true', '1', 'yes'].includes(String(value).trim().toLowerCase());
}

export async function seedProductsPrisma(companyId: string, orders: CsvRow[]) {
  const seen = new Set<string>();
  const toInsert: Array<{
    sku: string;
    productName: string;
    category: string;
    subcategory: string | null;
    price: number;
    companyId: string;
  }> = [];

  for (const row of orders) {
    const sku = text(row.product_sku);
    if (!sku || seen.has(sku)) continue;
    seen.add(sku);
    toInsert.push({
      sku,
      productName: text(row.product_name) || sku,
      category: text(row.category) || 'General',
      subcategory: text(row.subcategory) || null,
      price: validAmount(row.unit_price ?? row.price ?? row.amount) ?? 0,
      companyId,
    });
  }

  if (toInsert.length === 0) {
    logger.warn('No product SKUs found in orders CSV');
    return;
  }

  for (const product of toInsert) {
    await prisma.product.upsert({
      where: { companyId_sku: { companyId, sku: product.sku } },
      create: product,
      update: {
        productName: product.productName,
        category: product.category,
        subcategory: product.subcategory,
        price: product.price,
      },
    });
  }

  logger.info({ count: toInsert.length, companyId }, 'Products seeded');
}

export async function importCustomersPrisma(customers: CsvRow[], companyId: string) {
  const customerMap = new Map<string, string>();
  let skippedCustomers = 0;

  for (let i = 0; i < customers.length; i += CUSTOMER_BATCH_SIZE) {
    const batch = customers.slice(i, i + CUSTOMER_BATCH_SIZE);
    for (const row of batch) {
      const externalCustomerId = text(row.customer_id);
      if (!externalCustomerId) {
        skippedCustomers++;
        continue;
      }
      const signupDate = validDate(row.signup_date) ?? new Date();
      const created = await prisma.customer.upsert({
        where: { companyId_externalCustomerId: { companyId, externalCustomerId } },
        create: {
          companyId,
          externalCustomerId,
          firstName: text(row.first_name) || 'Customer',
          lastName: text(row.last_name) || null,
          email: text(row.email).toLowerCase() || null,
          phone: text(row.phone) || null,
          emailMarketingConsent: isConsentGranted(row.email_marketing_consent),
          smsMarketingConsent: isConsentGranted(row.sms_marketing_consent),
          gender: text(row.gender) || null,
          city: text(row.city) || null,
          state: text(row.state) || null,
          signupDate,
        },
        update: {
          firstName: text(row.first_name) || 'Customer',
          lastName: text(row.last_name) || null,
          email: text(row.email).toLowerCase() || null,
          phone: text(row.phone) || null,
          emailMarketingConsent: isConsentGranted(row.email_marketing_consent),
          smsMarketingConsent: isConsentGranted(row.sms_marketing_consent),
        },
      });
      customerMap.set(externalCustomerId, created.id);
    }
  }

  if (skippedCustomers > 0) logger.warn({ skippedCustomers, companyId }, 'Customer rows skipped during import');

  return customerMap;
}

export async function importOrdersPrisma(
  orders: CsvRow[],
  customerMap: Map<string, string>,
  companyId: string,
): Promise<OrderImportSummary> {
  const products = await prisma.product.findMany({
    where: { companyId },
    select: { id: true, sku: true },
  });
  const productMap = new Map(products.map((p) => [p.sku, p.id]));

  if (productMap.size === 0) {
    throw new Error('No products available for order item import');
  }

  const orderGroups = new Map<string, CleanOrderRow[]>();
  let skippedInvalidRows = 0;
  for (const row of orders) {
    const clean = cleanOrderRow(row);
    if (!clean) {
      skippedInvalidRows++;
      continue;
    }
    if (!orderGroups.has(clean.orderId)) orderGroups.set(clean.orderId, []);
    orderGroups.get(clean.orderId)!.push(clean);
  }
  const existingOrderIds = new Set((await prisma.order.findMany({
    where: { companyId, externalOrderId: { in: [...orderGroups.keys()] } },
    select: { externalOrderId: true },
  })).flatMap((order) => order.externalOrderId ? [order.externalOrderId] : []));

  const ordersToInsert: Array<{
    id: string;
    companyId: string;
    customerId: string;
    externalOrderId: string;
    orderDate: Date;
    totalAmount: number;
    channel: string | null;
  }> = [];
  const orderItemsToInsert: Array<{
    companyId: string;
    orderId: string;
    productId: string;
    quantity: number;
    unitPrice: number;
  }> = [];

  let skippedOrders = 0;
  let skippedItems = 0;

  for (const items of orderGroups.values()) {
    if (existingOrderIds.has(items[0].orderId)) {
      skippedOrders++;
      continue;
    }
    const customerId = customerMap.get(items[0].customerExternalId);
    if (!customerId) {
      skippedOrders++;
      continue;
    }

    const generatedOrderId = randomUUID();
    const validItems: typeof orderItemsToInsert = [];
    for (const item of items) {
      const productId = productMap.get(item.sku);
      if (!productId) {
        skippedItems++;
        continue;
      }
      validItems.push({
        companyId,
        orderId: generatedOrderId,
        productId,
        quantity: item.quantity,
        unitPrice: item.amount / item.quantity,
      });
    }
    if (!validItems.length) {
      skippedOrders++;
      continue;
    }
    ordersToInsert.push({
      id: generatedOrderId,
      companyId,
      externalOrderId: items[0].orderId,
      customerId,
      orderDate: items[0].orderDate,
      totalAmount: validItems.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0),
      channel: items[0].channel || 'Website',
    });
    orderItemsToInsert.push(...validItems);
  }

  for (let i = 0; i < ordersToInsert.length; i += INSERT_CHUNK_SIZE) {
    await prisma.order.createMany({ data: ordersToInsert.slice(i, i + INSERT_CHUNK_SIZE) });
  }
  for (let i = 0; i < orderItemsToInsert.length; i += INSERT_CHUNK_SIZE) {
    await prisma.orderItem.createMany({ data: orderItemsToInsert.slice(i, i + INSERT_CHUNK_SIZE) });
  }

  logger.info(
    {
      ordersInserted: ordersToInsert.length,
      orderItemsInserted: orderItemsToInsert.length,
      skippedOrders,
      skippedItems,
      skippedInvalidRows,
    },
    'Orders import complete',
  );

  return {
    ordersInserted: ordersToInsert.length,
    orderItemsInserted: orderItemsToInsert.length,
    skippedOrders,
    skippedItems: skippedItems + skippedInvalidRows,
  };
}

export async function ingestCsvIntoPrisma(companyId: string, customers: any[], orders: any[]) {
  await seedProductsPrisma(companyId, orders);
  const customerMap = await importCustomersPrisma(customers, companyId);
  const orderSummary = await importOrdersPrisma(orders, customerMap, companyId);
  const metrics = await generateCustomerMetricsPrisma(companyId);
  return { customerMap, orderSummary, metrics };
}

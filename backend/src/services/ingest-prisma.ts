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

export async function seedProductsPrisma(companyId: string, orders: any[]) {
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
    const sku = String(row.product_sku ?? '').trim();
    if (!sku || seen.has(sku)) continue;
    seen.add(sku);
    toInsert.push({
      sku,
      productName: String(row.product_name ?? '').trim() || sku,
      category: String(row.category ?? '').trim() || 'General',
      subcategory: String(row.subcategory ?? '').trim() || null,
      price: parseFloat(row.unit_price || row.price || row.amount || '0') || 0,
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

export async function importCustomersPrisma(customers: any[], companyId: string) {
  const customerMap = new Map<string, string>();

  for (let i = 0; i < customers.length; i += CUSTOMER_BATCH_SIZE) {
    const batch = customers.slice(i, i + CUSTOMER_BATCH_SIZE);
    for (const row of batch) {
      const externalCustomerId = String(row.customer_id ?? '').trim();
      if (!externalCustomerId) continue;
      const created = await prisma.customer.upsert({
        where: { companyId_externalCustomerId: { companyId, externalCustomerId } },
        create: {
          companyId,
          externalCustomerId,
          firstName: row.first_name ?? 'Customer',
          lastName: row.last_name || null,
          email: row.email || null,
          phone: row.phone || null,
          gender: row.gender || null,
          city: row.city || null,
          state: row.state || null,
          signupDate: row.signup_date ? new Date(row.signup_date) : new Date(),
        },
        update: {
          firstName: row.first_name ?? 'Customer',
          lastName: row.last_name || null,
          email: row.email || null,
          phone: row.phone || null,
        },
      });
      customerMap.set(externalCustomerId, created.id);
    }
  }

  return customerMap;
}

export async function importOrdersPrisma(
  orders: any[],
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

  const orderGroups = new Map<string, any[]>();
  for (const row of orders) {
    if (!orderGroups.has(row.order_id)) orderGroups.set(row.order_id, []);
    orderGroups.get(row.order_id)!.push(row);
  }

  const ordersToInsert: Array<{
    id: string;
    customerId: string;
    orderDate: Date;
    totalAmount: number;
    channel: string | null;
  }> = [];
  const orderItemsToInsert: Array<{
    orderId: string;
    productId: string;
    quantity: number;
    unitPrice: number;
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
    const totalAmount = items.reduce((sum: number, item: any) => sum + parseFloat(item.amount || '0'), 0);
    ordersToInsert.push({
      id: generatedOrderId,
      customerId,
      orderDate: new Date(items[0].order_date),
      totalAmount,
      channel: items[0].channel || 'Website',
    });

    for (const item of items) {
      const productId = productMap.get(item.product_sku);
      if (!productId) {
        skippedItems++;
        continue;
      }
      const quantity = parseInt(item.quantity, 10) || 1;
      orderItemsToInsert.push({
        orderId: generatedOrderId,
        productId,
        quantity,
        unitPrice: parseFloat(item.amount || '0') / quantity,
      });
    }
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
    },
    'Orders import complete',
  );

  return {
    ordersInserted: ordersToInsert.length,
    orderItemsInserted: orderItemsToInsert.length,
    skippedOrders,
    skippedItems,
  };
}

export async function ingestCsvIntoPrisma(companyId: string, customers: any[], orders: any[]) {
  await seedProductsPrisma(companyId, orders);
  const customerMap = await importCustomersPrisma(customers, companyId);
  const orderSummary = await importOrdersPrisma(orders, customerMap, companyId);
  const metrics = await generateCustomerMetricsPrisma(companyId);
  return { customerMap, orderSummary, metrics };
}

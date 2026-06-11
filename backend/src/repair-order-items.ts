import { createClient } from '@supabase/supabase-js';
import WebSocket from 'ws';
import csvParser from 'csv-parser';
import { createReadStream } from 'fs';
import path from 'path';
import 'dotenv/config';
import { seedProducts } from './data-generator/products';

type CsvOrderRow = {
  order_id: string;
  customer_id: string;
  order_date: string;
  product_sku: string;
  quantity: string;
  amount: string;
  channel: string;
};

type SupabaseOrderRow = {
  id: string;
  customer_id: string;
  order_date: string;
  total_amount: string | number;
  channel: string | null;
};

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function parseCsvFile<T>(filePath: string): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const rows: T[] = [];
    createReadStream(filePath)
      .pipe(csvParser())
      .on('data', (row) => rows.push(row as T))
      .on('end', () => resolve(rows))
      .on('error', reject);
  });
}

function toNumber(value: string | number | null | undefined): number {
  if (typeof value === 'number') return value;
  if (!value) return 0;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function repairOrderItems() {
  const supabaseUrl = requireEnv('NEXT_PUBLIC_SUPABASE_URL');
  const supabaseKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');

  const supabase = createClient(supabaseUrl, supabaseKey, {
    realtime: {
      transport: WebSocket as any,
    },
  });

  const ordersCsvPath = path.resolve(__dirname, '../generated-data/orders.csv');

  console.log('[repair] Loading source orders CSV:', ordersCsvPath);
  const csvRows = await parseCsvFile<CsvOrderRow>(ordersCsvPath);
  console.log(`[repair] Loaded ${csvRows.length} line items from CSV`);

  const { count: productCount } = await supabase
    .from('products')
    .select('id', { count: 'exact', head: true });

  if (!productCount || productCount === 0) {
    console.log('[repair] products table empty, seeding products...');
    await seedProducts(supabase);
  }

  const { data: products, error: productsError } = await supabase
    .from('products')
    .select('id, sku');

  if (productsError) {
    throw new Error(`Failed to load products: ${productsError.message}`);
  }

  const productMap = new Map((products ?? []).map((product) => [product.sku, product.id]));
  console.log(`[repair] Loaded ${productMap.size} products`);

  const { data: customers, error: customersError } = await supabase
    .from('customers')
    .select('id, external_customer_id');

  if (customersError) {
    throw new Error(`Failed to load customers: ${customersError.message}`);
  }

  const customerMap = new Map(
    (customers ?? []).map((customer) => [customer.external_customer_id, customer.id]),
  );

  const groupedOrders = new Map<string, CsvOrderRow[]>();
  for (const row of csvRows) {
    const group = groupedOrders.get(row.order_id) ?? [];
    group.push(row);
    groupedOrders.set(row.order_id, group);
  }

  let matchedOrders = 0;
  let insertedOrderItems = 0;
  let skippedOrders = 0;
  let skippedItems = 0;

  for (const [externalOrderId, rows] of groupedOrders.entries()) {
    const firstRow = rows[0];
    const customerId = customerMap.get(firstRow.customer_id);

    if (!customerId) {
      console.warn(`[repair] Missing customer mapping for ${firstRow.customer_id} (${externalOrderId})`);
      skippedOrders += 1;
      continue;
    }

    const expectedTotalAmount = rows.reduce((sum, row) => sum + toNumber(row.amount), 0);
    const { data: matchingOrders, error: orderLookupError } = await supabase
      .from('orders')
      .select('id, customer_id, order_date, total_amount, channel')
      .eq('customer_id', customerId)
      .eq('order_date', firstRow.order_date)
      .eq('total_amount', expectedTotalAmount)
      .eq('channel', firstRow.channel || 'Website');

    if (orderLookupError) {
      throw new Error(`Failed to look up order ${externalOrderId}: ${orderLookupError.message}`);
    }

    if (!matchingOrders || matchingOrders.length === 0) {
      console.warn(
        `[repair] No matching order found for ${externalOrderId} (customer=${firstRow.customer_id}, date=${firstRow.order_date}, amount=${expectedTotalAmount})`,
      );
      skippedOrders += 1;
      continue;
    }

    const order = matchingOrders[0] as SupabaseOrderRow;
    matchedOrders += 1;

    const { error: deleteError } = await supabase
      .from('order_items')
      .delete()
      .eq('order_id', order.id);

    if (deleteError) {
      throw new Error(`Failed to clear existing order items for ${order.id}: ${deleteError.message}`);
    }

    const items = rows
      .map((row) => {
        const productId = productMap.get(row.product_sku);
        if (!productId) {
          console.warn(`[repair] Missing product mapping for SKU ${row.product_sku} on order ${externalOrderId}`);
          skippedItems += 1;
          return null;
        }

        const quantity = Number.parseInt(row.quantity, 10) || 1;
        return {
          order_id: order.id,
          product_id: productId,
          quantity,
          unit_price: toNumber(row.amount) / quantity,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);

    if (items.length > 0) {
      const { error: insertError } = await supabase.from('order_items').insert(items);
      if (insertError) {
        throw new Error(`Failed to insert order items for ${externalOrderId}: ${insertError.message}`);
      }

      insertedOrderItems += items.length;
    }
  }

  const { count: orderItemsCount } = await supabase
    .from('order_items')
    .select('id', { count: 'exact', head: true });

  console.log('\n[repair] Done');
  console.log(`[repair] matched orders: ${matchedOrders}`);
  console.log(`[repair] inserted order items: ${insertedOrderItems}`);
  console.log(`[repair] total order_items rows now: ${orderItemsCount ?? 0}`);
  console.log(`[repair] skipped orders: ${skippedOrders}`);
  console.log(`[repair] skipped items: ${skippedItems}`);
}

if (require.main === module) {
  repairOrderItems().catch((error) => {
    console.error('[repair] Failed:', error);
    process.exit(1);
  });
}

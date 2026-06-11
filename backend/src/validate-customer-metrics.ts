import { createClient } from '@supabase/supabase-js';
import WebSocket from 'ws';
import 'dotenv/config';
import { generateCustomerMetrics } from './services/customer-metrics';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

async function main() {
  const supabaseUrl = requireEnv('NEXT_PUBLIC_SUPABASE_URL');
  const supabaseKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');

  const supabase = createClient(supabaseUrl, supabaseKey, {
    realtime: {
      transport: WebSocket as any,
    },
  });

  const report = await generateCustomerMetrics(supabase);

  console.log('\n=== Customer Metrics Validation Summary ===');
  console.log(`Generated at: ${report.generatedAt}`);
  console.log(`Total customers: ${report.totalCustomers}`);
  console.log(`Total metrics records: ${report.totalMetricsRecords}`);
  console.log(`Zero-order customers: ${report.zeroOrderCustomers}`);

  console.log('\nTop 10 customers by spend:');
  console.table(
    report.top10CustomersBySpend.map((row) => ({
      customer_id: row.customer_id,
      total_orders: row.total_orders,
      total_spent: row.total_spent,
      avg_order_value: row.avg_order_value,
      last_order_date: row.last_order_date,
      days_since_last_order: row.days_since_last_order,
      purchase_frequency: row.purchase_frequency,
      engagement_score: row.engagement_score,
    })),
  );

  console.log('\nTop 10 customers by order count:');
  console.table(
    report.top10CustomersByOrderCount.map((row) => ({
      customer_id: row.customer_id,
      total_orders: row.total_orders,
      total_spent: row.total_spent,
      avg_order_value: row.avg_order_value,
      last_order_date: row.last_order_date,
      days_since_last_order: row.days_since_last_order,
      purchase_frequency: row.purchase_frequency,
      engagement_score: row.engagement_score,
    })),
  );

  console.log('\nTop 10 dormant customers:');
  console.table(
    report.top10DormantCustomers.map((row) => ({
      customer_id: row.customer_id,
      total_orders: row.total_orders,
      total_spent: row.total_spent,
      avg_order_value: row.avg_order_value,
      last_order_date: row.last_order_date,
      days_since_last_order: row.days_since_last_order,
      purchase_frequency: row.purchase_frequency,
      engagement_score: row.engagement_score,
    })),
  );

  console.log('\nSample validation checks:');
  console.table(
    report.sampleValidations.map((row) => ({
      customer_id: row.customerId,
      customer_name: row.customerName,
      raw_order_count: row.rawOrderCount,
      raw_total_spent: row.rawTotalSpent,
      raw_last_order_date: row.rawLastOrderDate,
      stored_order_count: row.storedOrderCount,
      stored_total_spent: row.storedTotalSpent,
      stored_last_order_date: row.storedLastOrderDate,
      matches: row.matches,
    })),
  );

  const allMatched = report.sampleValidations.every((row) => row.matches);
  console.log(`\nValidation result: ${allMatched ? 'PASS' : 'FAIL'}`);

  if (!allMatched) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error('Customer metrics validation failed:', error);
  process.exit(1);
});

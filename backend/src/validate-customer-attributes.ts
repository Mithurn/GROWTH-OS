import { createClient } from '@supabase/supabase-js';
import WebSocket from 'ws';
import 'dotenv/config';
import { generateCustomerAttributes } from './services/customer-attributes';

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

  const report = await generateCustomerAttributes(supabase);

  console.log('\n=== Customer Attributes Validation Summary ===');
  console.log(`Generated at: ${report.generatedAt}`);
  console.log(`Total customers: ${report.totalCustomers}`);
  console.log(`Total orders: ${report.totalOrders}`);
  console.log(`Total attributes records: ${report.totalAttributesRecords}`);

  console.log('\nTop 10 categories:');
  console.table(report.topCategories);

  console.log('\nHighest discount affinity customers:');
  console.table(
    report.highestDiscountAffinityCustomers.map((row) => ({
      customer_id: row.customer_id,
      total_orders: row.total_orders,
      favorite_category: row.favorite_category,
      second_favorite_category: row.second_favorite_category,
      preferred_channel: row.preferred_channel,
      discount_affinity: row.discount_affinity,
      avg_days_between_orders: row.avg_days_between_orders,
      dominant_price_band: row.dominant_price_band,
      category_diversity_score: row.category_diversity_score,
    })),
  );

  console.log('\nStrongest category loyalty customers:');
  console.table(
    report.strongestCategoryLoyaltyCustomers.map((row) => ({
      customer_id: row.customer_id,
      total_orders: row.total_orders,
      favorite_category: row.favorite_category,
      second_favorite_category: row.second_favorite_category,
      preferred_channel: row.preferred_channel,
      discount_affinity: row.discount_affinity,
      avg_days_between_orders: row.avg_days_between_orders,
      dominant_price_band: row.dominant_price_band,
      category_diversity_score: row.category_diversity_score,
    })),
  );

  console.log('\nMost diverse customers:');
  console.table(
    report.mostDiverseCustomers.map((row) => ({
      customer_id: row.customer_id,
      total_orders: row.total_orders,
      favorite_category: row.favorite_category,
      second_favorite_category: row.second_favorite_category,
      preferred_channel: row.preferred_channel,
      discount_affinity: row.discount_affinity,
      avg_days_between_orders: row.avg_days_between_orders,
      dominant_price_band: row.dominant_price_band,
      category_diversity_score: row.category_diversity_score,
    })),
  );

  console.log('\nSample validation checks:');
  console.table(
    report.sampleValidations.map((row) => ({
      customer_id: row.customerId,
      customer_name: row.customerName,
      raw_favorite_category: row.rawFavoriteCategory,
      raw_second_favorite_category: row.rawSecondFavoriteCategory,
      raw_preferred_channel: row.rawPreferredChannel,
      raw_discount_affinity: row.rawDiscountAffinity,
      raw_avg_days_between_orders: row.rawAvgDaysBetweenOrders,
      raw_dominant_price_band: row.rawDominantPriceBand,
      raw_category_diversity_score: row.rawCategoryDiversityScore,
      stored_favorite_category: row.storedFavoriteCategory,
      stored_second_favorite_category: row.storedSecondFavoriteCategory,
      stored_preferred_channel: row.storedPreferredChannel,
      stored_discount_affinity: row.storedDiscountAffinity,
      stored_avg_days_between_orders: row.storedAvgDaysBetweenOrders,
      stored_dominant_price_band: row.storedDominantPriceBand,
      stored_category_diversity_score: row.storedCategoryDiversityScore,
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
  console.error('Customer attributes validation failed:', error);
  process.exit(1);
});

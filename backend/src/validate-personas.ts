import { createClient } from '@supabase/supabase-js';
import WebSocket from 'ws';
import 'dotenv/config';
import { generatePersonas } from './services/personas';

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

  const report = await generatePersonas(supabase);

  console.log('\n=== Persona Validation Summary ===');
  console.log(`Generated at: ${report.generatedAt}`);
  console.log(`Company ID: ${report.companyId}`);
  console.log(`Total customers: ${report.totalCustomers}`);
  console.log(`Total personas: ${report.totalPersonas}`);
  console.log(`Personas assigned: ${report.personasAssigned}`);
  console.log('Validation:', report.validation);

  console.log('\nPersona distribution:');
  console.table(
    report.personaDistribution.map((row) => ({
      persona_name: row.persona_name,
      customer_count: row.customer_count,
      total_spent: row.total_spent,
      average_spend: row.average_spend,
      revenue_share: row.revenue_share,
      average_orders: row.average_orders,
      average_days_since_last_order: row.average_days_since_last_order,
      persona_description: row.persona_description,
    })),
  );

  console.log('\nSample customers:');
  console.table(
    report.sampleCustomers.map((row) => ({
      customer_id: row.customer_id,
      customer_name: row.customer_name,
      persona_name: row.persona_name,
      persona_description: row.persona_description,
      confidence_score: row.confidence_score,
      total_spent: row.total_spent,
      total_orders: row.total_orders,
      days_since_last_order: row.days_since_last_order,
      favorite_category: row.favorite_category,
      preferred_channel: row.preferred_channel,
      discount_affinity: row.discount_affinity,
    })),
  );

  const allGood =
    report.validation.everyCustomerHasPersona &&
    report.validation.descriptionsPopulated &&
    report.validation.confidenceScoresPopulated;

  console.log(`\nValidation result: ${allGood ? 'PASS' : 'FAIL'}`);

  if (!allGood) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error('Persona validation failed:', error);
  process.exit(1);
});

import { createClient } from '@supabase/supabase-js';
import WebSocket from 'ws';
import 'dotenv/config';
import { generateOpportunities } from './services/opportunities';

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

  const report = await generateOpportunities(supabase);

  console.log('\n=== Opportunity Validation Summary ===');
  console.log(`Generated at: ${report.generatedAt}`);
  console.log(`Company ID: ${report.companyId}`);
  console.log(`Total customers: ${report.totalCustomers}`);
  console.log(`Total opportunities: ${report.totalOpportunities}`);
  console.log(`Total revenue potential: ₹${Math.round(report.totalRevenuePotential).toLocaleString('en-IN')}`);
  console.log('Validation:', report.validation);

  console.log('\nTop opportunities by priority:');
  console.table(
    report.topOpportunities.slice(0, 10).map((row) => ({
      opportunity_type: row.opportunity_type,
      title: row.title,
      audience_size: row.audience_size,
      potential_revenue: row.potential_revenue,
      confidence_score: row.confidence_score,
      priority_score: row.priority_score,
      customer_count: row.customer_count,
      status: row.status,
      trigger_reason: row.trigger_reason,
      ai_summary: row.ai_summary,
    })),
  );

  const allGood =
    report.validation.everyOpportunityHasAudience &&
    report.validation.everyOpportunityHasSummary &&
    report.validation.confidenceScoresPopulated &&
    report.validation.opportunityCountReasonable;

  console.log(`\nValidation result: ${allGood ? 'PASS' : 'FAIL'}`);

  if (!allGood) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error('Opportunity validation failed:', error);
  process.exit(1);
});

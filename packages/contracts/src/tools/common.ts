import { z } from 'zod';

export const ResponseFormat = z.enum(['concise', 'detailed']).default('concise');

export const OpportunityTypeSchema = z.enum([
  'Retention-Churn',
  'Retention-VIP',
  'Upsell',
  'Reactivation',
]);

export type OpportunityType = z.infer<typeof OpportunityTypeSchema>;

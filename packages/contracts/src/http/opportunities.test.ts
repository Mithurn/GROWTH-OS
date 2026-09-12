import { describe, it, expect } from 'vitest';
import {
  CreateOpportunityFromGoalSchema,
  GenerateOpportunitiesSchema,
  RefineOpportunitySchema,
} from './opportunities';

describe('opportunity schemas', () => {
  it('treats model as optional everywhere it appears', () => {
    expect(GenerateOpportunitiesSchema.safeParse({}).success).toBe(true);
    expect(CreateOpportunityFromGoalSchema.safeParse({ goal: 'grow AOV' }).success).toBe(true);
  });

  it('requires a non-empty goal and a non-empty modifier', () => {
    expect(CreateOpportunityFromGoalSchema.safeParse({ goal: '' }).success).toBe(false);
    expect(RefineOpportunitySchema.safeParse({ modifier: '' }).success).toBe(false);
    expect(RefineOpportunitySchema.safeParse({ modifier: 'make it shorter' }).success).toBe(true);
  });
});

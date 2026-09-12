import { z } from 'zod';

export const GenerateOpportunitiesSchema = z.object({
  model: z.string().optional(),
});

export const RefineOpportunitySchema = z.object({
  modifier: z.string().min(1, 'modifier is required'),
});

export const CreateOpportunityFromGoalSchema = z.object({
  goal:  z.string().min(1, 'goal is required'),
  model: z.string().optional(),
});

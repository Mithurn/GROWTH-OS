import { z } from 'zod';

export const CreateAgentSchema = z.object({
  goal: z.string().min(1, 'goal is required'),
  guardrails: z.record(z.string(), z.unknown()).optional(),
});

export const PatchAgentSchema = z.object({
  status:     z.string().optional(),
  goal:       z.string().optional(),
  guardrails: z.record(z.string(), z.unknown()).optional(),
}).refine((d) => Object.keys(d).length > 0, { message: 'At least one field is required' });

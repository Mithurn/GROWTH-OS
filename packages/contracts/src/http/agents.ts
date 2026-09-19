import { z } from 'zod';

export const InvolvementModeSchema = z.enum([
  'manual',
  'approve_above_threshold',
  'autonomous_within_policy',
]);
export type InvolvementMode = z.infer<typeof InvolvementModeSchema>;

export const CreateAgentSchema = z.object({
  goal: z.string().min(1, 'goal is required'),
  involvementMode: InvolvementModeSchema.default('manual'),
  guardrails: z.record(z.string(), z.unknown()).optional(),
});

export const PatchAgentSchema = z.object({
  status:     z.string().optional(),
  goal:       z.string().optional(),
  involvementMode: InvolvementModeSchema.optional(),
  guardrails: z.record(z.string(), z.unknown()).optional(),
}).refine((d) => Object.keys(d).length > 0, { message: 'At least one field is required' });

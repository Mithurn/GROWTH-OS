import { z } from 'zod';

export const MappingEntitySchema = z.enum(['customer', 'order', 'product']);
export const MappingTransformSchema = z.enum([
  'identity',
  'trim',
  'lowercase',
  'phone',
  'email',
  'date',
  'currency',
  'number',
]);

export const MappingColumnSpec = z.object({
  entity: MappingEntitySchema,
  source_column: z.string().min(1),
  target_field: z.string().min(1),
  transform: MappingTransformSchema.default('identity'),
  confidence: z.number().min(0).max(1),
  reasoning: z.string().max(240).optional(),
});

/**
 * Proposed or accepted column mapping for one upload shape.
 * Unmapped columns are explicit — never silently dropped.
 */
export const MappingSpec = z.object({
  version: z.literal(1),
  fingerprint: z.string().min(1),
  entity: MappingEntitySchema,
  columns: z.array(MappingColumnSpec),
  unmapped: z.array(z.string()),
});

export type MappingSpec = z.infer<typeof MappingSpec>;
export type MappingColumnSpec = z.infer<typeof MappingColumnSpec>;

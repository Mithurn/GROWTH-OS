import { z } from 'zod';

export const GeneratePersonasSchema = z.object({
  model: z.string().optional(),
});

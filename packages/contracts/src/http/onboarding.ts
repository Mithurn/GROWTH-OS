import { z } from 'zod';

export const OnboardingBusinessSchema = z.object({
  companyName: z.string().min(1, 'companyName is required'),
  industry: z.string().optional(),
});

export const OnboardingProfileSchema = z.object({
  profile: z.record(z.string(), z.unknown()),
});

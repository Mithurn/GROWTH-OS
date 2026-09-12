import { z } from 'zod';

export const OnboardingBusinessSchema = z.object({
  companyName: z.string().min(1, 'companyName is required'),
  industry: z.string().optional(),
});

export const OnboardingProfileSchema = z.object({
  profile: z.record(z.string(), z.unknown()),
});

export const ConversationMessageSchema = z.object({
  message: z.string().min(1, 'message is required'),
});

export const OnboardingCompleteSchema = z.object({
  conversationId: z.string().min(1, 'conversationId is required'),
});

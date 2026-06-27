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

export const GeneratePersonasSchema = z.object({
  model: z.string().optional(),
});

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

export const GenerateCampaignSchema = z.object({
  opportunityId: z.string().min(1, 'opportunityId is required'),
  model: z.string().optional(),
});

export const SaveCampaignSchema = z.object({
  opportunityId: z.string().min(1, 'opportunityId is required'),
  campaign: z.record(z.string(), z.unknown()),
});

export const RefineCampaignSchema = z.object({
  modifier: z.string().optional().default(''),
  channel:  z.string().optional(),
});

export const CreateAgentSchema = z.object({
  goal: z.string().min(1, 'goal is required'),
  guardrails: z.record(z.string(), z.unknown()).optional(),
});

export const PatchAgentSchema = z.object({
  status:     z.string().optional(),
  goal:       z.string().optional(),
  guardrails: z.record(z.string(), z.unknown()).optional(),
}).refine((d) => Object.keys(d).length > 0, { message: 'At least one field is required' });

import { Router } from 'express';
import { supabase } from '../lib/supabase';
import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';
import {
  requireAuth,
  resolveCompanyMiddleware,
  requireCompanyOwnership,
  type AuthRequest,
} from '../middleware/auth';
import { llmLimiter } from '../middleware/rate-limits';
import { validateBody } from '../middleware/validate';
import { startConversation, sendMessage, getConversation } from '../services/onboarding-chat';
import {
  OnboardingBusinessSchema,
  OnboardingProfileSchema,
  ConversationMessageSchema,
  OnboardingCompleteSchema,
} from '../lib/schemas';

export const onboardingRouter = Router();

onboardingRouter.post(
  '/onboarding/business',
  requireAuth,
  validateBody(OnboardingBusinessSchema),
  async (req: AuthRequest, res) => {
    try {
      const { companyName, industry } = req.body;

      // Re-running onboarding must not create a second company for the same user.
      const { data: existing } = await supabase
        .from('profiles')
        .select('company_id, companies(id, company_name, industry)')
        .eq('id', req.userId!)
        .maybeSingle();

      if (existing?.companies) {
        return res.json({ success: true, data: existing.companies });
      }

      const { data: company, error } = await supabase
        .from('companies')
        .insert({ company_name: companyName, industry, user_id: req.userId })
        .select('id, company_name, industry')
        .single();

      if (error) throw error;

      // The profile row is what every later request resolves tenancy through.
      await supabase.from('profiles').insert({
        id: req.userId,
        company_id: company.id,
        role: 'owner',
      });

      res.json({ success: true, data: company });
    } catch (error) {
      logger.error({ err: error }, 'Error saving business info');
      res.status(500).json({ error: 'Failed to save business info' });
    }
  },
);

onboardingRouter.post(
  '/onboarding/profile',
  requireAuth,
  resolveCompanyMiddleware,
  validateBody(OnboardingProfileSchema),
  async (req: AuthRequest, res) => {
    try {
      const { profile } = req.body;

      const { data, error } = await supabase
        .from('companies')
        .update({
          onboarding_profile: profile,
          onboarding_completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', req.companyId)
        .select('id, company_name, industry, onboarding_profile, onboarding_completed_at')
        .single();

      if (error) throw error;

      res.json({ success: true, data });
    } catch (error) {
      logger.error({ err: error }, 'Error saving onboarding profile');
      res.status(500).json({ error: 'Failed to save onboarding profile' });
    }
  },
);

onboardingRouter.post(
  '/onboarding/conversation/start',
  requireAuth,
  resolveCompanyMiddleware,
  llmLimiter,
  async (req: AuthRequest, res) => {
    try {
      const conversation = await startConversation(supabase, req.companyId!);
      res.json({ success: true, data: conversation });
    } catch (error) {
      logger.error({ err: error }, 'Error starting conversation');
      res.status(500).json({ error: 'Failed to start conversation' });
    }
  },
);

onboardingRouter.post(
  '/onboarding/conversation/:id/message',
  requireAuth,
  resolveCompanyMiddleware,
  requireCompanyOwnership('onboarding_conversations'),
  llmLimiter,
  validateBody(ConversationMessageSchema),
  async (req: AuthRequest, res) => {
    try {
      const id = req.params['id'] as string;
      const { message } = req.body;

      const conversation = await sendMessage(supabase, id, message);
      res.json({ success: true, data: conversation });
    } catch (error) {
      logger.error({ err: error }, 'Error sending message');
      res.status(500).json({ error: 'Failed to send message' });
    }
  },
);

onboardingRouter.get(
  '/onboarding/conversation/:id',
  requireAuth,
  resolveCompanyMiddleware,
  requireCompanyOwnership('onboarding_conversations'),
  async (req: AuthRequest, res) => {
    try {
      const id = req.params['id'] as string;
      const conversation = await getConversation(supabase, id);

      if (!conversation) {
        return res.status(404).json({ error: 'Conversation not found' });
      }

      res.json({ success: true, data: conversation });
    } catch (error) {
      logger.error({ err: error }, 'Error fetching conversation');
      res.status(500).json({ error: 'Failed to fetch conversation' });
    }
  },
);

/**
 * Finalize onboarding and create the company's first autonomous agent from what the
 * conversation extracted.
 */
onboardingRouter.post(
  '/onboarding/complete',
  requireAuth,
  resolveCompanyMiddleware,
  validateBody(OnboardingCompleteSchema),
  async (req: AuthRequest, res) => {
    try {
      const { conversationId } = req.body;

      const conversation = await getConversation(supabase, conversationId);

      if (!conversation) {
        return res.status(404).json({ error: 'Conversation not found' });
      }

      if (!conversation.completed) {
        return res.status(400).json({ error: 'Conversation not completed yet' });
      }

      const extractedData = conversation.extractedData;

      const { data: company, error: companyError } = await supabase
        .from('companies')
        .update({
          onboarding_profile: extractedData,
          onboarding_completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', req.companyId)
        .select()
        .single();

      if (companyError) throw companyError;

      const priority = extractedData.priority?.[0] || 'Increase revenue';
      const channels = extractedData.channels || ['WhatsApp', 'Email'];
      const involvement = extractedData.involvement?.[0] || 'review major campaigns only';

      const agent = await prisma.agent.create({
        data: {
          companyId: req.companyId!,
          name: `${priority} Agent`,
          goal: priority,
          status: 'discovering',
          guardrails: {
            channels,
            involvement,
            max_budget: 100000,
            frequency_cap: 3,
          },
        },
      });

      logger.info(
        { companyId: req.companyId, agentId: agent.id },
        'Onboarding complete, agent created',
      );

      res.json({ success: true, data: { company, agent } });
    } catch (error) {
      logger.error({ err: error }, 'Error completing onboarding');
      res.status(500).json({ error: 'Failed to complete onboarding' });
    }
  },
);

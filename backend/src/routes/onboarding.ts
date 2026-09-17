import { Router } from 'express';
import { supabase } from '../lib/supabase';
import { logger } from '../lib/logger';
import {
  requireAuth,
  resolveCompanyMiddleware,
  type AuthRequest,
} from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import {
  OnboardingBusinessSchema,
  OnboardingProfileSchema,
} from '@growthos/contracts';

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

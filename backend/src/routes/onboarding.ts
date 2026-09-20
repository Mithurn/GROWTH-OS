import { Router } from 'express';
import { prisma } from '../lib/prisma';
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
      const existing = await prisma.profile.findUnique({
        where: { id: req.userId! },
        include: { company: { select: { id: true, companyName: true, industry: true } } },
      });
      if (existing) {
        return res.json({
          success: true,
          data: {
            id: existing.company.id,
            company_name: existing.company.companyName,
            industry: existing.company.industry,
          },
        });
      }

      const company = await prisma.$transaction(async (tx) => {
        const created = await tx.company.create({
          data: { companyName, industry, userId: req.userId },
          select: { id: true, companyName: true, industry: true },
        });
        await tx.profile.create({
          data: { id: req.userId!, companyId: created.id, role: 'owner' },
        });
        return created;
      });

      res.json({
        success: true,
        data: { id: company.id, company_name: company.companyName, industry: company.industry },
      });
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

      const company = await prisma.company.update({
        where: { id: req.companyId },
        data: { onboardingProfile: profile, onboardingCompletedAt: new Date() },
      });

      res.json({
        success: true,
        data: {
          id: company.id,
          company_name: company.companyName,
          industry: company.industry,
          onboarding_profile: company.onboardingProfile,
          onboarding_completed_at: company.onboardingCompletedAt,
        },
      });
    } catch (error) {
      logger.error({ err: error }, 'Error saving onboarding profile');
      res.status(500).json({ error: 'Failed to save onboarding profile' });
    }
  },
);

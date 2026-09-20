import { Router, type Response } from 'express';
import { logger } from '../lib/logger';
import { getCached, setCached } from '../lib/cache';
import { requireAuth, resolveCompanyMiddleware, type AuthRequest } from '../middleware/auth';
import { llmLimiter } from '../middleware/rate-limits';
import {
  generateIntelligenceBrief,
  getCampaignFunnel,
  getOpportunityPipeline,
  getChannelPerformance,
  getOpportunityDistribution,
  getOpportunityTrend,
  getActivityFeed,
  getRecommendedActions,
} from '../services/analytics';

export const analyticsRouter = Router();

const ANALYTICS_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Build a read-through cached handler.
 *
 * Every analytics endpoint is the same shape — cache key from the company (plus any
 * query params that change the result), serve a hit, otherwise compute and store. The
 * cache prefers Redis (survives spin-down) and falls back to process memory.
 */
function cachedRoute<T>(
  name: string,
  compute: (companyId: string, req: AuthRequest) => Promise<T>,
  keyParts: (req: AuthRequest) => string[] = () => [],
) {
  return async (req: AuthRequest, res: Response) => {
    try {
      const key = [name, req.companyId, ...keyParts(req)].join(':');

      const hit = await getCached<T>(key);
      if (hit) return res.json({ success: true, data: hit, cached: true });

      const data = await compute(req.companyId!, req);
      await setCached(key, data, ANALYTICS_TTL);
      res.json({ success: true, data });
    } catch (error) {
      logger.error({ err: error, route: name }, 'Analytics request failed');
      res.status(500).json({ error: `Failed to fetch ${name}` });
    }
  };
}

const authed = [requireAuth, resolveCompanyMiddleware] as const;

// The only analytics route that calls the model, hence the extra limiter.
analyticsRouter.get(
  '/analytics/intelligence-brief',
  ...authed,
  llmLimiter,
  cachedRoute('intelligence-brief', (companyId) => generateIntelligenceBrief(companyId)),
);

analyticsRouter.get(
  '/analytics/campaign-funnel',
  ...authed,
  cachedRoute('campaign-funnel', (companyId) => getCampaignFunnel(companyId)),
);

analyticsRouter.get(
  '/analytics/opportunity-pipeline',
  ...authed,
  cachedRoute('opportunity-pipeline', (companyId) => getOpportunityPipeline(companyId)),
);

analyticsRouter.get(
  '/analytics/channel-performance',
  ...authed,
  cachedRoute('channel-performance', (companyId) => getChannelPerformance(companyId)),
);

analyticsRouter.get(
  '/analytics/opportunity-distribution',
  ...authed,
  cachedRoute('opportunity-distribution', (companyId) =>
    getOpportunityDistribution(companyId),
  ),
);

analyticsRouter.get(
  '/analytics/opportunity-trend',
  ...authed,
  cachedRoute(
    'opportunity-trend',
    (companyId, req) => getOpportunityTrend(trendDays(req), companyId),
    (req) => [String(trendDays(req))],
  ),
);

analyticsRouter.get(
  '/analytics/activity-feed',
  ...authed,
  cachedRoute(
    'activity-feed',
    (companyId, req) => getActivityFeed(feedLimit(req), companyId),
    (req) => [String(feedLimit(req))],
  ),
);

analyticsRouter.get(
  '/analytics/recommended-actions',
  ...authed,
  cachedRoute('recommended-actions', (companyId) => getRecommendedActions(companyId)),
);

function trendDays(req: AuthRequest): number {
  const value = Number.parseInt(String(req.query.days ?? ''), 10);
  return Number.isFinite(value) ? Math.min(365, Math.max(1, value)) : 30;
}

function feedLimit(req: AuthRequest): number {
  const value = Number.parseInt(String(req.query.limit ?? ''), 10);
  return Number.isFinite(value) ? Math.min(100, Math.max(1, value)) : 20;
}

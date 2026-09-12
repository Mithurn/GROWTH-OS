import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';
import { subscribeToActivity } from '../lib/activity-emitter';
import {
  requireAuth,
  resolveCompanyMiddleware,
  requireCompanyOwnership,
  type AuthRequest,
} from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { agentOrchestrator } from '../services/agent-orchestrator';
import { getRecentActions } from '../services/agent-logger';
import { CreateAgentSchema, PatchAgentSchema } from '@growthos/contracts';

export const agentsRouter = Router();

const DEFAULT_GUARDRAILS = {
  max_budget: 50000,
  frequency_cap: 3,
  channels: ['whatsapp', 'email'],
};

agentsRouter.post(
  '/agents',
  requireAuth,
  resolveCompanyMiddleware,
  validateBody(CreateAgentSchema),
  async (req: AuthRequest, res) => {
    try {
      const { goal, guardrails } = req.body;

      const agent = await prisma.agent.create({
        data: {
          companyId: req.companyId!,
          name: `${goal.substring(0, 30)} Agent`,
          goal,
          status: 'discovering',
          guardrails: guardrails || DEFAULT_GUARDRAILS,
          performance: { revenue: 0, conversion_rate: 0, customers_reached: 0 },
        },
      });

      // Run once immediately so a new agent shows activity without waiting for the
      // scheduled run. Detached on purpose — discovery is slower than the request.
      agentOrchestrator.runAgentOnce(agent.id).catch((err) => {
        logger.error({ err, agentId: agent.id }, 'Error running agent');
      });

      res.json({ success: true, data: agent });
    } catch (error) {
      logger.error({ err: error }, 'Error creating agent');
      res.status(500).json({ error: 'Failed to create agent' });
    }
  },
);

agentsRouter.get(
  '/agents',
  requireAuth,
  resolveCompanyMiddleware,
  async (req: AuthRequest, res) => {
    try {
      const page = Math.max(1, parseInt(req.query['page'] as string) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query['limit'] as string) || 20));
      const where = { companyId: req.companyId! };
      const [agents, total] = await Promise.all([
        prisma.agent.findMany({
          where,
          include: { _count: { select: { opportunities: true, campaigns: true, actions: true } } },
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.agent.count({ where }),
      ]);
      res.json({
        success: true,
        data: agents,
        meta: { page, limit, total, pages: Math.ceil(total / limit) },
      });
    } catch (error) {
      logger.error({ err: error }, 'Error fetching agents');
      res.status(500).json({ error: 'Failed to fetch agents' });
    }
  },
);

agentsRouter.get(
  '/agents/:id',
  requireAuth,
  resolveCompanyMiddleware,
  requireCompanyOwnership('agents'),
  async (req: AuthRequest, res) => {
    try {
      const id = req.params['id'] as string;
      const agent = await prisma.agent.findUnique({
        where: { id },
        include: {
          opportunities: { orderBy: { createdAt: 'desc' }, take: 10 },
          campaigns: { orderBy: { createdAt: 'desc' }, take: 10 },
          actions: { orderBy: { createdAt: 'desc' }, take: 20 },
        },
      });

      if (!agent) return res.status(404).json({ error: 'Agent not found' });
      res.json({ success: true, data: agent });
    } catch (error) {
      logger.error({ err: error }, 'Error fetching agent');
      res.status(500).json({ error: 'Failed to fetch agent' });
    }
  },
);

agentsRouter.post(
  '/agents/:id/run',
  requireAuth,
  resolveCompanyMiddleware,
  requireCompanyOwnership('agents'),
  async (req: AuthRequest, res) => {
    try {
      const id = req.params['id'] as string;
      await agentOrchestrator.runAgentOnce(id);
      res.json({ success: true, message: 'Agent execution triggered' });
    } catch (error) {
      logger.error({ err: error }, 'Error running agent');
      res.status(500).json({ error: 'Failed to run agent' });
    }
  },
);

agentsRouter.patch(
  '/agents/:id',
  requireAuth,
  resolveCompanyMiddleware,
  requireCompanyOwnership('agents'),
  validateBody(PatchAgentSchema),
  async (req: AuthRequest, res) => {
    try {
      const id = req.params['id'] as string;
      const { status, guardrails } = req.body;
      const agent = await prisma.agent.update({
        where: { id },
        data: { status: status || undefined, guardrails: guardrails || undefined },
      });
      res.json({ success: true, data: agent });
    } catch (error) {
      logger.error({ err: error }, 'Error updating agent');
      res.status(500).json({ error: 'Failed to update agent' });
    }
  },
);

/** Paginated history of agent actions. */
agentsRouter.get(
  '/activity-stream',
  requireAuth,
  resolveCompanyMiddleware,
  async (req: AuthRequest, res) => {
    try {
      const page = Math.max(1, parseInt(req.query['page'] as string) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query['limit'] as string) || 50));
      const actions = await getRecentActions(req.companyId!, limit, page);
      res.json({ success: true, data: actions });
    } catch (error) {
      logger.error({ err: error }, 'Error fetching activity stream');
      res.status(500).json({ error: 'Failed to fetch activity stream' });
    }
  },
);

/**
 * Live agent activity as server-sent events. Events go through Redis pub/sub when
 * `REDIS_URL` is set, so a reconnect after spin-down still sees activity produced
 * before the instance died. Falls back to the in-process emitter locally.
 */
agentsRouter.get(
  '/sse/activity',
  requireAuth,
  resolveCompanyMiddleware,
  async (req: AuthRequest, res) => {
    const unsubscribe = await subscribeToActivity(res, req.companyId!);
    req.on('close', unsubscribe);
  },
);

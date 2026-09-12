import { Router } from 'express';
import { logger } from '../lib/logger';
import { requireInternalSecret } from '../middleware/auth';
import { agentOrchestrator } from '../services/agent-orchestrator';

export const internalRouter = Router();

/**
 * Drive one orchestrator tick from an external scheduler.
 *
 * The autonomous agent loop used to live in a `setInterval`, which never fired in
 * production: Render's free tier sleeps the instance after 15 minutes idle and the
 * timer dies with the process. Guarded by a shared secret rather than a user JWT,
 * because there is no user behind the call.
 */
internalRouter.post('/internal/agents/run-scheduled', requireInternalSecret, async (_req, res) => {
  try {
    const result = await agentOrchestrator.runAllAgents();
    res.json({ success: true, ...result });
  } catch (error) {
    logger.error({ err: error }, 'Scheduled agent run failed');
    res.status(500).json({ error: 'Scheduled agent run failed' });
  }
});

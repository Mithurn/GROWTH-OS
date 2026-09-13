import { Router } from 'express';
import { logger } from '../lib/logger';
import { requireInternalSecret } from '../middleware/auth';
import { agentOrchestrator } from '../services/agent-orchestrator';
import { mcpToolsList } from '@growthos/agent-core';

export const internalRouter = Router();

/**
 * Drive one orchestrator tick from an external scheduler.
 *
 * The autonomous agent loop used to live in a `setInterval`, which never fired in
 * production: Render's free tier sleeps the instance after 15 minutes idle and the
 * timer dies with the process. Guarded by a shared secret rather than a user JWT,
 * because there is no user behind the call.
 */
/**
 * Same registry the graph binds (DESIGN.md §4 / ARCHITECTURE_V2 §3.4).
 * Zod schemas stay in-process — JSON here is names + descriptions so an
 * MCP client or a local test can see the bound surface without a second server.
 */
internalRouter.get('/internal/agent/tools', requireInternalSecret, (_req, res) => {
  const tools = mcpToolsList('shadow').map((t: { name: string; description: string; annotations: unknown }) => ({
    name: t.name,
    description: t.description,
    annotations: t.annotations,
  }));
  res.json({ mode: 'shadow', tools });
});

internalRouter.post('/internal/agents/run-scheduled', requireInternalSecret, async (_req, res) => {
  try {
    const result = await agentOrchestrator.runAllAgents();
    res.json({ success: true, ...result });
  } catch (error) {
    logger.error({ err: error }, 'Scheduled agent run failed');
    res.status(500).json({ error: 'Scheduled agent run failed' });
  }
});

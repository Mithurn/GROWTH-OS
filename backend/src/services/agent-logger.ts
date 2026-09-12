import { prisma } from '../lib/prisma';
import { emitActivity } from '../lib/activity-emitter';
import { logger } from '../lib/logger';

interface LogActionParams {
  agentId: string;
  actionType: 'discovered_opportunity' | 'created_campaign' | 'launched_campaign' | 'sent_messages' | 'achieved_milestone' | 'paused' | 'resumed';
  description: string;
  details?: any;
}

/**
 * Log an agent action to the activity stream
 * This powers the live activity feed on the frontend
 */
export async function logAgentAction(params: LogActionParams) {
  const { agentId, actionType, description, details } = params;

  try {
    const action = await prisma.agentAction.create({
      data: {
        agentId,
        actionType,
        description,
        details: details || {}
      },
      // companyId travels with the event so the SSE stream can scope it to one tenant.
      include: { agent: { select: { companyId: true } } },
    });

    emitActivity({
      id: action.id,
      companyId: action.agent.companyId,
      agentId: action.agentId,
      actionType: action.actionType,
      description: action.description,
      details: (action.details as Record<string, unknown>) ?? {},
      createdAt: action.createdAt,
    });
    return action;
  } catch (error) {
    logger.error({ err: error }, 'Error logging agent action');
    throw error;
  }
}

/**
 * Get recent agent actions for activity feed
 */
export async function getRecentActions(companyId: string, limit: number = 50, page: number = 1) {
  try {
    const actions = await prisma.agentAction.findMany({
      where: {
        agent: {
          companyId
        }
      },
      include: {
        agent: {
          select: {
            name: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      skip: (page - 1) * limit,
      take: limit
    });

    return actions;
  } catch (error) {
    logger.error({ err: error }, 'Error fetching recent actions');
    throw error;
  }
}

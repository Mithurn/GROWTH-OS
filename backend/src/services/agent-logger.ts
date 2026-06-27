import { prisma } from '../lib/prisma';
import { emitActivity } from '../lib/activity-emitter';

interface LogActionParams {
  agentId: string;
  actionType: 'discovered_opportunity' | 'launched_campaign' | 'sent_messages' | 'achieved_milestone' | 'paused' | 'resumed';
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
      }
    });

    emitActivity({
      id: action.id,
      agentId: action.agentId,
      actionType: action.actionType,
      description: action.description,
      details: (action.details as Record<string, unknown>) ?? {},
      createdAt: action.createdAt,
    });
    return action;
  } catch (error) {
    console.error('Error logging agent action:', error);
    throw error;
  }
}

/**
 * Get recent agent actions for activity feed
 */
export async function getRecentActions(companyId: string, limit: number = 50) {
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
      take: limit
    });

    return actions;
  } catch (error) {
    console.error('Error fetching recent actions:', error);
    throw error;
  }
}

/**
 * Get actions for a specific agent
 */
export async function getAgentActions(agentId: string, limit: number = 100) {
  try {
    const actions = await prisma.agentAction.findMany({
      where: {
        agentId
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: limit
    });

    return actions;
  } catch (error) {
    console.error('Error fetching agent actions:', error);
    throw error;
  }
}

import type { Response } from 'express';
import { appendTenantEvent, subscribeTenantStream } from './tenant-stream';

export interface ActivityEvent {
  id: string;
  companyId: string;
  agentId: string;
  actionType: string;
  description: string;
  details?: Record<string, unknown>;
  createdAt: Date | string;
}

export function emitActivity(action: ActivityEvent): void {
  void appendTenantEvent(action.companyId, action.actionType, {
    id: action.id,
    agentId: action.agentId,
    description: action.description,
    details: action.details ?? {},
    createdAt: typeof action.createdAt === 'string' ? action.createdAt : action.createdAt.toISOString(),
  });
}

export async function subscribeToActivity(
  res: Response,
  companyId: string,
  lastEventId?: string,
): Promise<() => void> {
  return subscribeTenantStream(res, companyId, { lastEventId });
}

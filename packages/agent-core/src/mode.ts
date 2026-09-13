import type { PermissionMode } from './types';

/**
 * Live mutating tools require two switches. Either one off → shadow.
 * The orchestrator never passes live. A tenant flag alone is not enough.
 */
export function resolvePermissionMode(input: {
  envLive?: string;
  tenantLive?: boolean;
}): PermissionMode {
  return input.envLive === '1' && input.tenantLive === true ? 'live' : 'shadow';
}

import { describe, it, expect } from 'vitest';
import { resolvePermissionMode } from './mode';

describe('resolvePermissionMode', () => {
  it('stays shadow unless both the process flag and the tenant flag are on', () => {
    expect(resolvePermissionMode({})).toBe('shadow');
    expect(resolvePermissionMode({ envLive: '1' })).toBe('shadow');
    expect(resolvePermissionMode({ tenantLive: true })).toBe('shadow');
    expect(resolvePermissionMode({ envLive: '1', tenantLive: true })).toBe('live');
    expect(resolvePermissionMode({ envLive: 'true', tenantLive: true })).toBe('shadow');
  });
});

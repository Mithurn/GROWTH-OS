import { describe, expect, it, vi } from 'vitest';
import { requireOwner } from './auth';

describe('requireOwner', () => {
  it('rejects a member before a campaign can be approved or launched', () => {
    const status = vi.fn().mockReturnThis();
    const json = vi.fn();
    const next = vi.fn();
    requireOwner({ role: 'member' } as any, { status, json } as any, next);
    expect(status).toHaveBeenCalledWith(403);
    expect(json).toHaveBeenCalledWith({ error: 'Owner access required' });
    expect(next).not.toHaveBeenCalled();
  });
});

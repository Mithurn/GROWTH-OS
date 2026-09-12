import { describe, it, expect } from 'vitest';
import { checkGuardrails } from './check';

describe('checkGuardrails', () => {
  it('allows when there are no guardrails at all', () => {
    expect(checkGuardrails({ potentialRevenue: 100000 }, {})).toEqual({ allowed: true });
  });

  it('denies when potentialRevenue exceeds max_budget', () => {
    const result = checkGuardrails(
      { potentialRevenue: 60000 },
      { max_budget: 50000 },
    );
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/max_budget/);
  });

  it('allows when potentialRevenue is exactly at max_budget', () => {
    expect(
      checkGuardrails({ potentialRevenue: 50000 }, { max_budget: 50000 }).allowed,
    ).toBe(true);
  });

  it('denies a channel not on the allowlist', () => {
    const result = checkGuardrails(
      { potentialRevenue: 100, channel: 'sms' },
      { channels: ['whatsapp', 'email'] },
    );
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/channel/);
  });

  it('allows a channel on the allowlist', () => {
    expect(
      checkGuardrails(
        { potentialRevenue: 100, channel: 'email' },
        { channels: ['whatsapp', 'email'] },
      ).allowed,
    ).toBe(true);
  });

  it('does not enforce a channel check when the subject has no channel', () => {
    expect(
      checkGuardrails({ potentialRevenue: 100 }, { channels: ['whatsapp'] }).allowed,
    ).toBe(true);
  });
});

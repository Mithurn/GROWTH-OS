import { describe, it, expect } from 'vitest';
import { CreateAgentSchema, PatchAgentSchema } from './agents';

describe('CreateAgentSchema', () => {
  it('requires a non-empty goal', () => {
    expect(CreateAgentSchema.safeParse({ goal: '' }).success).toBe(false);
    expect(CreateAgentSchema.safeParse({}).success).toBe(false);
    expect(CreateAgentSchema.safeParse({ goal: 'win back churned buyers' }).success).toBe(true);
  });

  it('accepts guardrails as an arbitrary object and leaves it optional', () => {
    const parsed = CreateAgentSchema.parse({ goal: 'g', guardrails: { max_budget: 0 } });
    expect(parsed.guardrails).toEqual({ max_budget: 0 });
    expect(CreateAgentSchema.parse({ goal: 'g' }).guardrails).toBeUndefined();
  });

  it('defaults to manual involvement and rejects free text', () => {
    expect(CreateAgentSchema.parse({ goal: 'g' }).involvementMode).toBe('manual');
    expect(CreateAgentSchema.safeParse({ goal: 'g', involvementMode: 'autopilot' }).success).toBe(false);
  });
});

describe('PatchAgentSchema', () => {
  it('rejects an empty patch', () => {
    expect(PatchAgentSchema.safeParse({}).success).toBe(false);
  });

  it('accepts any single field', () => {
    expect(PatchAgentSchema.safeParse({ status: 'paused' }).success).toBe(true);
    expect(PatchAgentSchema.safeParse({ goal: 'new goal' }).success).toBe(true);
    expect(PatchAgentSchema.safeParse({ guardrails: {} }).success).toBe(true);
    expect(PatchAgentSchema.safeParse({ involvementMode: 'autonomous_within_policy' }).success).toBe(true);
  });
});

import { describe, it, expect } from 'vitest';
import { GeneratePersonasSchema } from './personas';

describe('GeneratePersonasSchema', () => {
  it('accepts an empty body, since model is optional', () => {
    const parsed = GeneratePersonasSchema.parse({});
    expect(parsed.model).toBeUndefined();
  });

  it('accepts an explicit model override', () => {
    expect(GeneratePersonasSchema.parse({ model: 'anthropic/claude-opus-4' }).model).toBe(
      'anthropic/claude-opus-4',
    );
  });

  it('rejects a non-string model', () => {
    expect(GeneratePersonasSchema.safeParse({ model: 42 }).success).toBe(false);
  });
});

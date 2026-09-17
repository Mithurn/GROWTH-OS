import { describe, it, expect } from 'vitest';
import { MappingSpec } from './mapping';

describe('MappingSpec', () => {
  it('requires an explicit unmapped list — silent drop is invalid', () => {
    const parsed = MappingSpec.safeParse({
      version: 1,
      fingerprint: 'abc',
      entity: 'customer',
      columns: [
        {
          entity: 'customer',
          source_column: 'email',
          target_field: 'email',
          transform: 'email',
          confidence: 0.95,
        },
      ],
    });
    expect(parsed.success).toBe(false);
  });

  it('accepts a reviewed mapping with leftovers declared', () => {
    const spec = MappingSpec.parse({
      version: 1,
      fingerprint: 'headers:email,first_name',
      entity: 'customer',
      columns: [
        {
          entity: 'customer',
          source_column: 'Email',
          target_field: 'email',
          transform: 'email',
          confidence: 0.96,
        },
      ],
      unmapped: ['notes'],
    });
    expect(spec.unmapped).toEqual(['notes']);
    expect(spec.columns[0].target_field).toBe('email');
  });
});

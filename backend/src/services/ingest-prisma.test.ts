import { describe, expect, it } from 'vitest';
import { isConsentGranted } from './ingest-prisma';

describe('retailer consent imports', () => {
  it('recognizes only explicit affirmative values', async () => {
    expect(isConsentGranted('yes')).toBe(true);
    expect(isConsentGranted('false')).toBe(false);
    expect(isConsentGranted(undefined)).toBe(false);
  });
});

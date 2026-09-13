import { describe, it, expect } from 'vitest';
import { fingerprintHeaders, proposeMapping, sniffCsv } from './sniff';

describe('sniffCsv', () => {
  it('strips a BOM, detects a comma header, and fingerprints stably', () => {
    const csv = '\uFEFFemail,first_name,notes\nada@ex.com,Ada,vip\n';
    const profile = sniffCsv(csv);
    expect(profile.delimiter).toBe(',');
    expect(profile.headers).toEqual(['email', 'first_name', 'notes']);
    expect(profile.fingerprint).toBe(fingerprintHeaders(['email', 'first_name', 'notes']));
    expect(profile.sampleRows[0]).toEqual(['ada@ex.com', 'Ada', 'vip']);
  });

  it('proposes customer mappings and lists leftovers instead of dropping them', () => {
    const spec = proposeMapping(['Email Address', 'First Name', 'notes']);
    expect(spec.entity).toBe('customer');
    expect(spec.columns.some((c) => c.target_field === 'email')).toBe(true);
    expect(spec.columns.some((c) => c.target_field === 'first_name')).toBe(true);
    expect(spec.unmapped).toContain('notes');
  });

  it('prefers order when the header looks like a Shopify export', () => {
    const spec = proposeMapping(['order_id', 'customer_id', 'sku', 'amount', 'quantity']);
    expect(spec.entity).toBe('order');
    expect(spec.columns.some((c) => c.target_field === 'product_sku')).toBe(true);
    expect(spec.columns.some((c) => c.target_field === 'amount')).toBe(true);
  });
});

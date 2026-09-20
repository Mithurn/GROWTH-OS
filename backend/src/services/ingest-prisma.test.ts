import { describe, expect, it } from 'vitest';
import { cleanOrderRow, isConsentGranted } from './ingest-prisma';

describe('retailer consent imports', () => {
  it('recognizes only explicit affirmative values', async () => {
    expect(isConsentGranted('yes')).toBe(true);
    expect(isConsentGranted('false')).toBe(false);
    expect(isConsentGranted(undefined)).toBe(false);
  });
});

describe('retailer order imports', () => {
  it('normalizes valid rows and rejects malformed financial data', () => {
    expect(cleanOrderRow({
      order_id: ' order-1 ',
      customer_id: ' customer-1 ',
      order_date: '2026-01-02',
      product_sku: ' sku-1 ',
      amount: '1,250.50',
      quantity: '2',
      channel: ' Website ',
    })).toMatchObject({
      orderId: 'order-1',
      customerExternalId: 'customer-1',
      sku: 'sku-1',
      amount: 1250.5,
      quantity: 2,
      channel: 'Website',
    });
    expect(cleanOrderRow({ order_id: 'order-2', customer_id: 'customer-2', order_date: 'bad', product_sku: 'sku', amount: '-1' })).toBeNull();
  });
});

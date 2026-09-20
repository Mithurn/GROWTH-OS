import { describe, expect, it } from 'vitest';
import { campaignRiskReasons } from './campaign-risk-review';

describe('campaignRiskReasons', () => {
  it('blocks common social-engineering terms and extreme discounts', () => {
    expect(campaignRiskReasons('Share your OTP for 80% off today')).toEqual([
      'Message contains a credential, payment, or gift-card fraud term',
      'Message offers a discount above the 50% safety threshold',
    ]);
  });

  it('allows an ordinary offer', () => {
    expect(campaignRiskReasons('Welcome back — enjoy 20% off your next order.')).toEqual([]);
  });
});

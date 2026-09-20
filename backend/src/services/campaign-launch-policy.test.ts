import { describe, expect, it } from 'vitest';
import { launchPolicyReason } from './campaign-launch-policy';

const customer = {
  email: 'ada@example.com',
  phone: '+15555550123',
  emailMarketingConsent: true,
  smsMarketingConsent: true,
};

describe('launchPolicyReason', () => {
  it('fails closed for missing consent and quiet hours', () => {
    expect(launchPolicyReason({
      channel: 'Email',
      timezone: 'UTC',
      customers: [{ ...customer, emailMarketingConsent: false }],
      allowedChannels: ['Email'],
      quietHours: { startHour: 21, endHour: 9 },
      potentialRevenue: 100,
      maxBudget: 1000,
      now: new Date('2026-01-01T12:00:00Z'),
    })).toMatch(/consent/);

    expect(launchPolicyReason({
      channel: 'Email',
      timezone: 'UTC',
      customers: [customer],
      allowedChannels: ['Email'],
      quietHours: { startHour: 21, endHour: 9 },
      potentialRevenue: 100,
      maxBudget: 1000,
      now: new Date('2026-01-01T23:00:00Z'),
    })).toMatch(/quiet hours/);
  });

  it('enforces the configured budget guardrail', () => {
    expect(launchPolicyReason({
      channel: 'Email',
      timezone: 'UTC',
      customers: [customer],
      allowedChannels: ['Email'],
      quietHours: { startHour: 21, endHour: 9 },
      potentialRevenue: 1001,
      maxBudget: 1000,
      now: new Date('2026-01-01T12:00:00Z'),
    })).toMatch(/budget/);
  });

  it('accepts normalized channel policy and rejects invalid timezones', () => {
    expect(launchPolicyReason({
      channel: 'Email', timezone: 'UTC', customers: [customer], allowedChannels: ['email'],
      quietHours: { startHour: 21, endHour: 9 }, potentialRevenue: 100, maxBudget: 1000,
      now: new Date('2026-01-01T12:00:00Z'),
    })).toBeNull();
    expect(launchPolicyReason({
      channel: 'Email', timezone: 'not-a-timezone', customers: [customer], allowedChannels: ['Email'],
      quietHours: { startHour: 21, endHour: 9 }, potentialRevenue: 100, maxBudget: 1000,
      now: new Date('2026-01-01T12:00:00Z'),
    })).toMatch(/timezone/);
  });
});

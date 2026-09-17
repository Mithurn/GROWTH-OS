import { describe, it, expect } from 'vitest';
import {
  OnboardingBusinessSchema,
  OnboardingProfileSchema,
} from './onboarding';

describe('onboarding schemas', () => {
  it('requires a company name but leaves industry optional', () => {
    expect(OnboardingBusinessSchema.safeParse({ companyName: '' }).success).toBe(false);
    expect(OnboardingBusinessSchema.parse({ companyName: 'Acme' })).toEqual({ companyName: 'Acme' });
  });

  it('requires a profile object', () => {
    expect(OnboardingProfileSchema.safeParse({}).success).toBe(false);
    expect(OnboardingProfileSchema.safeParse({ profile: { tone: 'warm' } }).success).toBe(true);
  });
});

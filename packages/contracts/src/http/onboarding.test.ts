import { describe, it, expect } from 'vitest';
import {
  ConversationMessageSchema,
  OnboardingBusinessSchema,
  OnboardingCompleteSchema,
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

  it('requires non-empty message and conversationId strings', () => {
    expect(ConversationMessageSchema.safeParse({ message: '' }).success).toBe(false);
    expect(OnboardingCompleteSchema.safeParse({ conversationId: '' }).success).toBe(false);
    expect(ConversationMessageSchema.safeParse({ message: 'hi' }).success).toBe(true);
    expect(OnboardingCompleteSchema.safeParse({ conversationId: 'c1' }).success).toBe(true);
  });
});

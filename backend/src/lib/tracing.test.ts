import { describe, it, expect } from 'vitest';
import { ROOT_CONTEXT, SpanKind } from '@opentelemetry/api';
import { SamplingDecision } from '@opentelemetry/sdk-trace-node';
import { GrowthRootSampler, parseOtelHeaders } from './tracing';

describe('parseOtelHeaders', () => {
  it('splits comma pairs and keeps values that contain =', () => {
    expect(parseOtelHeaders('Authorization=Basic abc==,x-langfuse-ingestion-version=4')).toEqual({
      Authorization: 'Basic abc==',
      'x-langfuse-ingestion-version': '4',
    });
  });

  it('returns undefined for empty or malformed input', () => {
    expect(parseOtelHeaders(undefined)).toBeUndefined();
    expect(parseOtelHeaders('')).toBeUndefined();
    expect(parseOtelHeaders('no-equals')).toBeUndefined();
  });
});

describe('GrowthRootSampler', () => {
  const sampler = new GrowthRootSampler();
  const sample = (name: string) =>
    sampler.shouldSample(ROOT_CONTEXT, 'a'.repeat(32), name, SpanKind.INTERNAL, {}, []).decision;

  it('always records agent, job, llm, webhook, and campaign work', () => {
    expect(sample('bullmq.ingestion')).toBe(SamplingDecision.RECORD_AND_SAMPLED);
    expect(sample('langgraph.planner')).toBe(SamplingDecision.RECORD_AND_SAMPLED);
    expect(sample('llm.chat.completions google/gemini-2.5-flash')).toBe(SamplingDecision.RECORD_AND_SAMPLED);
    expect(sample('POST /api/internal/agents/run-scheduled')).toBe(SamplingDecision.RECORD_AND_SAMPLED);
    expect(sample('POST /api/webhooks/channel-status')).toBe(SamplingDecision.RECORD_AND_SAMPLED);
    expect(sample('POST /api/campaigns/:id/launch')).toBe(SamplingDecision.RECORD_AND_SAMPLED);
  });
});

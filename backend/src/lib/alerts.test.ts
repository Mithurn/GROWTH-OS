import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetAlertCooldowns, sendAlert } from './alerts';
import { fetchRemainingCredits, reportLlmFailure } from './llm-watch';

const fetchMock = vi.fn();

beforeEach(() => {
  resetAlertCooldowns();
  fetchMock.mockReset();
  fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({}) });
  vi.stubGlobal('fetch', fetchMock);
  vi.stubEnv('ALERT_WEBHOOK_URL', 'https://hooks.example.com/abc');
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('sendAlert', () => {
  it('posts a Slack and Discord compatible body', async () => {
    await sendAlert({ key: 'a', severity: 'critical', title: 'Down', detail: 'why' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.text).toContain('Down');
    expect(body.content).toBe(body.text);
  });

  it('sends a repeated key once per cooldown', async () => {
    await sendAlert({ key: 'a', severity: 'warning', title: 'x' });
    await sendAlert({ key: 'a', severity: 'warning', title: 'x' });
    await sendAlert({ key: 'b', severity: 'warning', title: 'x' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does nothing without a webhook and never throws when it fails', async () => {
    vi.stubEnv('ALERT_WEBHOOK_URL', '');
    await sendAlert({ key: 'quiet', severity: 'warning', title: 'x' });
    expect(fetchMock).not.toHaveBeenCalled();

    vi.stubEnv('ALERT_WEBHOOK_URL', 'https://hooks.example.com/abc');
    fetchMock.mockRejectedValueOnce(new Error('network'));
    await expect(sendAlert({ key: 'loud', severity: 'warning', title: 'x' })).resolves.toBeUndefined();
  });
});

describe('reportLlmFailure', () => {
  it('alerts on exhausted credits but not on an ordinary error', async () => {
    reportLlmFailure({ status: 402, message: 'insufficient credits' });
    reportLlmFailure(new Error('schema mismatch'));
    await Promise.resolve();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).text).toContain('credits are exhausted');
  });
});

describe('fetchRemainingCredits', () => {
  it('prefers the key limit and falls back to the account balance', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ data: { limit_remaining: 3.5 } }) });
    expect(await fetchRemainingCredits('k', 'https://or.test/api/v1')).toBe(3.5);

    fetchMock
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ data: { limit_remaining: null } }) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ data: { total_credits: 10, total_usage: 7.25 } }) });
    expect(await fetchRemainingCredits('k', 'https://or.test/api/v1')).toBe(2.75);
  });
});

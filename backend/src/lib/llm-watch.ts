import { logger } from './logger';
import { sendAlert } from './alerts';

const DEFAULT_MIN_CREDITS_USD = 2;
const CREDIT_CHECK_INTERVAL_MS = 30 * 60 * 1000;
const CHECK_TIMEOUT_MS = 10_000;

/**
 * Turns an OpenRouter failure into an alert a human can act on. Only failures that need a
 * person (out of credit, bad key, sustained rate limiting or provider outage) are reported;
 * an ordinary schema retry is not.
 */
export function reportLlmFailure(err: unknown): void {
  const status = (err as { status?: number } | null)?.status;
  const message = err instanceof Error ? err.message : String(err);

  if (status === 402) {
    void sendAlert({ key: 'llm:402', severity: 'critical', title: 'OpenRouter credits are exhausted', detail: `Top up the account. ${message}` });
  } else if (status === 401 || status === 403) {
    void sendAlert({ key: `llm:${status}`, severity: 'critical', title: 'OpenRouter rejected the API key', detail: `Check OPENROUTER_API_KEY. ${message}` });
  } else if (status === 429) {
    void sendAlert({ key: 'llm:429', severity: 'warning', title: 'OpenRouter is rate limiting requests', detail: message });
  } else if (status !== undefined && status >= 500) {
    void sendAlert({ key: 'llm:5xx', severity: 'warning', title: `OpenRouter is failing (${status})`, detail: message });
  }
}

interface KeyInfo {
  data?: { limit_remaining?: number | null; limit?: number | null; usage?: number };
}

interface CreditsInfo {
  data?: { total_credits?: number; total_usage?: number };
}

async function getJson<T>(url: string, apiKey: string): Promise<T | null> {
  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(CHECK_TIMEOUT_MS),
    });
    if (res.status === 401 || res.status === 403) {
      reportLlmFailure({ status: res.status, message: `credit check got ${res.status}` });
      return null;
    }
    return res.ok ? ((await res.json()) as T) : null;
  } catch (err) {
    logger.warn({ err }, 'OpenRouter credit check failed');
    return null;
  }
}

/** Remaining USD on the platform key, or null when OpenRouter does not say. */
export async function fetchRemainingCredits(apiKey: string, baseUrl: string): Promise<number | null> {
  const key = await getJson<KeyInfo>(`${baseUrl}/auth/key`, apiKey);
  const remaining = key?.data?.limit_remaining;
  if (typeof remaining === 'number') return remaining;

  // A key without its own limit draws on the account balance.
  const credits = await getJson<CreditsInfo>(`${baseUrl}/credits`, apiKey);
  const total = credits?.data?.total_credits;
  const used = credits?.data?.total_usage;
  return typeof total === 'number' && typeof used === 'number' ? total - used : null;
}

export async function checkCredits(apiKey: string, baseUrl: string): Promise<void> {
  const minimum = Number(process.env.OPENROUTER_MIN_CREDITS_USD) || DEFAULT_MIN_CREDITS_USD;
  const remaining = await fetchRemainingCredits(apiKey, baseUrl);
  if (remaining === null || remaining >= minimum) return;
  await sendAlert({
    key: 'llm:low-credits',
    severity: remaining <= 0 ? 'critical' : 'warning',
    title: `OpenRouter credits are low: $${remaining.toFixed(2)} left`,
    detail: `Alert threshold is $${minimum.toFixed(2)} (OPENROUTER_MIN_CREDITS_USD).`,
  });
}

/** Checks now and then every 30 minutes. The timer never keeps the process alive. */
export function startCreditMonitor(apiKey: string, baseUrl: string): () => void {
  if (!apiKey) return () => undefined;
  void checkCredits(apiKey, baseUrl);
  const timer = setInterval(() => void checkCredits(apiKey, baseUrl), CREDIT_CHECK_INTERVAL_MS);
  timer.unref();
  return () => clearInterval(timer);
}

import OpenAI from 'openai';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

export const openRouterConfig = {
  apiKey: requireEnv('OPENROUTER_API_KEY'),
  baseUrl: process.env.OPENROUTER_BASE_URL ?? 'https://openrouter.ai/api/v1',
  appName: process.env.OPENROUTER_APP_NAME ?? 'growthOS',
  httpReferer: process.env.OPENROUTER_HTTP_REFERER ?? 'http://localhost:3000',
  defaultModel: process.env.OPENROUTER_MODEL ?? 'google/gemini-2.5-flash',
} as const;

/**
 * Every generation path runs behind a user waiting on an HTTP response, or a queue
 * worker holding a job. Without a ceiling a hung upstream call blocks either one
 * indefinitely, so requests are capped and retried once.
 */
const REQUEST_TIMEOUT_MS = 60_000;

/**
 * Shared OpenRouter client.
 *
 * Previously each service built its own, and `onboarding-chat.ts` built one straight
 * from `process.env` with no fallbacks — so an unset `OPENROUTER_BASE_URL` left the
 * SDK pointed at its own default host, sending an OpenRouter key to OpenAI. It also
 * defaulted to a different model than the shared config. One client removes both
 * failure modes.
 */
export const openai = new OpenAI({
  apiKey: openRouterConfig.apiKey,
  baseURL: openRouterConfig.baseUrl,
  timeout: REQUEST_TIMEOUT_MS,
  maxRetries: 1,
  defaultHeaders: {
    'HTTP-Referer': openRouterConfig.httpReferer,
    'X-Title': openRouterConfig.appName,
  },
});

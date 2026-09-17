import OpenAI from 'openai';

/**
 * Production must have a key (Render). Local / test may boot without one —
 * the shadow observer falls back to observeScriptPlanner. Discovery and
 * campaign workers still fail at the first LLM call, which is honest.
 */
if (process.env.NODE_ENV === 'production' && !process.env.OPENROUTER_API_KEY) {
  throw new Error('Missing required environment variable: OPENROUTER_API_KEY');
}

export const openRouterConfig = {
  apiKey: process.env.OPENROUTER_API_KEY ?? '',
  baseUrl: process.env.OPENROUTER_BASE_URL ?? 'https://openrouter.ai/api/v1',
  appName: process.env.OPENROUTER_APP_NAME ?? 'growthOS',
  httpReferer: process.env.OPENROUTER_HTTP_REFERER ?? 'http://localhost:3000',
  defaultModel: process.env.OPENROUTER_MODEL ?? 'google/gemini-2.5-flash',
  get configured(): boolean {
    return Boolean(process.env.OPENROUTER_API_KEY);
  },
};

/**
 * Every generation path runs behind a user waiting on an HTTP response, or a queue
 * worker holding a job. Without a ceiling a hung upstream call blocks either one
 * indefinitely, so requests are capped and retried once.
 */
const REQUEST_TIMEOUT_MS = 60_000;

export const openai = new OpenAI({
  // SDK 6 refuses to construct with an empty key. Local/scripted observe
  // never calls this client; a placeholder keeps the process bootable.
  apiKey: openRouterConfig.apiKey || 'missing-openrouter-key',
  baseURL: openRouterConfig.baseUrl,
  timeout: REQUEST_TIMEOUT_MS,
  maxRetries: 1,
  defaultHeaders: {
    'HTTP-Referer': openRouterConfig.httpReferer,
    'X-Title': openRouterConfig.appName,
  },
});

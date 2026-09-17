import OpenAI from 'openai';
import { SpanStatusCode } from '@opentelemetry/api';
import { tracer } from '../lib/tracing';
import { schemaDefault } from '@growthos/contracts/config/registry';

/**
 * Production must have a key (Render). Local / test may boot without one —
 * the shadow observer falls back to observeScriptPlanner. Discovery and
 * campaign workers still fail at the first LLM call, which is honest.
 */
if (process.env.NODE_ENV === 'production' && !process.env.OPENROUTER_API_KEY) {
  throw new Error('Missing required environment variable: OPENROUTER_API_KEY');
}

/**
 * `defaultModel`/`timeout`/`maxRetries` used to be bare literals here. They now
 * come from the same CONFIG_REGISTRY every other config key does (env var still
 * wins if set, for a local override with no DB round-trip). This module is
 * imported before Redis/Postgres are guaranteed ready, and the `openai` client
 * below needs these values synchronously at construction — so this reads the
 * registry's own schema default (pure, no I/O) rather than `getConfig`'s live
 * per-tenant DB lookup.
 * ponytail: global default only, not live per-tenant override — 13 call sites
 * read `openRouterConfig.defaultModel` directly today; wiring per-tenant model
 * choice through all of them is future work if BYOK model selection needs it.
 */
export const openRouterConfig = {
  apiKey: process.env.OPENROUTER_API_KEY ?? '',
  baseUrl: process.env.OPENROUTER_BASE_URL ?? 'https://openrouter.ai/api/v1',
  appName: process.env.OPENROUTER_APP_NAME ?? 'growthOS',
  httpReferer: process.env.OPENROUTER_HTTP_REFERER ?? 'http://localhost:3000',
  defaultModel: process.env.OPENROUTER_MODEL ?? schemaDefault('llm.model'),
  timeoutMs: Number(process.env.OPENROUTER_TIMEOUT_MS) || schemaDefault('llm.timeout_ms'),
  maxRetries: process.env.OPENROUTER_MAX_RETRIES !== undefined
    ? Number(process.env.OPENROUTER_MAX_RETRIES)
    : schemaDefault('llm.max_retries'),
  get configured(): boolean {
    return Boolean(process.env.OPENROUTER_API_KEY);
  },
};

export const openai = new OpenAI({
  // SDK 6 refuses to construct with an empty key. Local/scripted observe
  // never calls this client; a placeholder keeps the process bootable.
  apiKey: openRouterConfig.apiKey || 'missing-openrouter-key',
  baseURL: openRouterConfig.baseUrl,
  timeout: openRouterConfig.timeoutMs,
  maxRetries: openRouterConfig.maxRetries,
  defaultHeaders: {
    'HTTP-Referer': openRouterConfig.httpReferer,
    'X-Title': openRouterConfig.appName,
  },
});

/**
 * Every call site shares this one client, so wrapping `.create` here traces
 * every LLM call in the app — personas, opportunities, campaigns, the agent
 * planner — without touching each call site individually.
 */
const originalCreate = openai.chat.completions.create.bind(openai.chat.completions);
openai.chat.completions.create = (async (...args: Parameters<typeof originalCreate>) => {
  const [params] = args;
  return tracer.startActiveSpan(`llm.chat.completions ${params.model}`, async (span) => {
    span.setAttribute('llm.model', params.model);
    span.setAttribute('llm.stream', Boolean(params.stream));
    span.setAttribute('gen_ai.operation.name', 'chat');
    span.setAttribute('gen_ai.request.model', params.model);
    try {
      const response = await originalCreate(...args);
      const usage = (response as { usage?: { prompt_tokens?: number; completion_tokens?: number } }).usage;
      if (usage) {
        span.setAttribute('llm.tokens.prompt', usage.prompt_tokens ?? 0);
        span.setAttribute('llm.tokens.completion', usage.completion_tokens ?? 0);
        span.setAttribute('gen_ai.usage.input_tokens', usage.prompt_tokens ?? 0);
        span.setAttribute('gen_ai.usage.output_tokens', usage.completion_tokens ?? 0);
      }
      return response;
    } catch (err) {
      span.recordException(err as Error);
      span.setStatus({ code: SpanStatusCode.ERROR, message: (err as Error).message });
      throw err;
    } finally {
      span.end();
    }
  });
}) as typeof originalCreate;

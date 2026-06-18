import { z } from 'zod';

function stripMarkdown(raw: string): string {
  return raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```\s*$/, '').trim();
}

/**
 * Calls an LLM, parses the JSON response, validates it against a Zod schema,
 * and retries up to maxAttempts times with exponential backoff on any failure.
 * Throws after all attempts are exhausted.
 */
export async function parseWithRetry<T>(
  callFn: () => Promise<string>,
  schema: z.ZodSchema<T>,
  maxAttempts = 3,
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const raw = await callFn();
      const json = JSON.parse(stripMarkdown(raw));
      const result = schema.safeParse(json);
      if (result.success) return result.data;
      throw new Error(`AI response schema mismatch: ${result.error.message}`);
    } catch (err) {
      lastError = err;
      if (attempt < maxAttempts) {
        const delay = 1000 * 2 ** (attempt - 1);
        console.warn(
          `[AI] Attempt ${attempt}/${maxAttempts} failed, retrying in ${delay}ms:`,
          err instanceof Error ? err.message : err,
        );
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }

  throw lastError;
}

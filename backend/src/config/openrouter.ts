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
  appName: process.env.OPENROUTER_APP_NAME ?? 'xeno-grow',
  httpReferer: process.env.OPENROUTER_HTTP_REFERER ?? 'http://localhost:3000',
  defaultModel: process.env.OPENROUTER_MODEL ?? 'google/gemini-2.5-flash',
} as const;

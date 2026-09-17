import { trace } from '@opentelemetry/api';

/**
 * Optional Sentry reporting. No SDK dependency — posts the store endpoint when
 * `SENTRY_DSN` is set, and is a no-op otherwise so local/CI stay silent.
 *
 * DSN shape: https://<key>@<host>/<projectId>
 */
export function captureException(err: unknown, extra?: Record<string, unknown>): void {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;

  const parsed = parseDsn(dsn);
  if (!parsed) return;

  const error = err instanceof Error ? err : new Error(String(err));
  const sc = trace.getActiveSpan()?.spanContext();
  const payload = {
    message: error.message,
    exception: {
      values: [
        {
          type: error.name,
          value: error.message,
          stacktrace: { frames: framesFromStack(error.stack) },
        },
      ],
    },
    extra: { ...extra, traceId: sc?.traceId },
    contexts: sc ? { trace: { trace_id: sc.traceId, span_id: sc.spanId } } : undefined,
    timestamp: Date.now() / 1000,
    platform: 'node',
    server_name: process.env.RENDER_SERVICE_NAME ?? 'growthos-backend',
    environment: process.env.NODE_ENV ?? 'development',
  };

  const url = `${parsed.protocol}//${parsed.host}/api/${parsed.projectId}/store/`;
  fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Sentry-Auth': `Sentry sentry_version=7, sentry_key=${parsed.key}, sentry_client=growthos/1.0`,
    },
    body: JSON.stringify(payload),
  }).catch(() => {
    // reporting must never take the request down
  });
}

function parseDsn(dsn: string): { protocol: string; host: string; key: string; projectId: string } | null {
  try {
    const url = new URL(dsn);
    const projectId = url.pathname.replace(/^\//, '');
    if (!url.username || !projectId) return null;
    return {
      protocol: url.protocol,
      host: url.host,
      key: url.username,
      projectId,
    };
  } catch {
    return null;
  }
}

function framesFromStack(stack?: string): Array<{ filename: string; function: string; lineno: number }> {
  if (!stack) return [];
  return stack
    .split('\n')
    .slice(1, 21)
    .map((line) => {
      const match = line.match(/at\s+(.+?)\s+\((.+):(\d+):\d+\)/) ?? line.match(/at\s+(.+):(\d+):\d+/);
      if (!match) return { filename: 'unknown', function: line.trim(), lineno: 0 };
      if (match[3]) {
        return { filename: match[2]!, function: match[1]!, lineno: Number(match[3]) };
      }
      return { filename: match[1]!, function: 'anonymous', lineno: Number(match[2]) };
    })
    .reverse();
}

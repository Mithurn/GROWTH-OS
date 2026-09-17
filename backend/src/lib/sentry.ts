import * as Sentry from '@sentry/node';
import { trace } from '@opentelemetry/api';

/**
 * Error tracking via the real SDK. `initTracing()` (lib/tracing.ts) already owns
 * the OpenTelemetry tracer provider end to end — sampling policy, OTLP export,
 * the esbuild bundling guard CI checks for — so Sentry's own OTel auto-instrumentation
 * is left off here (`skipOpenTelemetrySetup`) rather than risk a second provider
 * fighting the first. Correlation to the existing trace is manual: every captured
 * event carries the active span's trace id, searchable in both systems.
 *
 * A no-op when `SENTRY_DSN` is unset, so local/CI stay silent.
 */
export function initSentry(): void {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;

  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV ?? 'development',
    serverName: process.env.RENDER_SERVICE_NAME ?? 'growthos-backend',
    skipOpenTelemetrySetup: true,
    tracesSampleRate: 0,
    // Unhandled rejections and uncaught exceptions crash the process either way;
    // this only decides whether Sentry gets to report the crash before it exits.
    integrations: (defaults) =>
      defaults.filter((i) => i.name !== 'Http' && i.name !== 'Express'),
  });
}

export function captureException(err: unknown, extra?: Record<string, unknown>): void {
  if (!process.env.SENTRY_DSN) return;

  const sc = trace.getActiveSpan()?.spanContext();
  Sentry.withScope((scope) => {
    if (extra) scope.setExtras(extra);
    if (sc) {
      scope.setTag('trace_id', sc.traceId);
      scope.setContext('trace', { trace_id: sc.traceId, span_id: sc.spanId });
    }
    Sentry.captureException(err);
  });
}

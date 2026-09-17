import { NodeTracerProvider, BatchSpanProcessor, ConsoleSpanExporter } from '@opentelemetry/sdk-trace-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';
import { context, propagation, trace } from '@opentelemetry/api';

function parseOtelHeaders(raw: string | undefined): Record<string, string> | undefined {
  if (!raw) return undefined;
  const headers: Record<string, string> = {};
  for (const pair of raw.split(',')) {
    const eq = pair.indexOf('=');
    if (eq === -1) continue;
    headers[pair.slice(0, eq).trim()] = pair.slice(eq + 1).trim();
  }
  return Object.keys(headers).length ? headers : undefined;
}

export function initTracing(): void {
  const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
  const exporter = endpoint
    ? new OTLPTraceExporter({
        url: `${endpoint.replace(/\/$/, '')}/v1/traces`,
        headers: parseOtelHeaders(process.env.OTEL_EXPORTER_OTLP_HEADERS),
      })
    : new ConsoleSpanExporter();

  const provider = new NodeTracerProvider({
    resource: resourceFromAttributes({
      [ATTR_SERVICE_NAME]: 'growthos-channel',
      [ATTR_SERVICE_VERSION]: process.env.RENDER_GIT_COMMIT ?? 'local',
    }),
    spanProcessors: [new BatchSpanProcessor(exporter)],
  });
  provider.register();

  const shutdown = () => {
    void provider.shutdown();
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

export const tracer = trace.getTracer('growthos-channel');

export function injectTraceHeaders(headers: Record<string, string>): Record<string, string> {
  propagation.inject(context.active(), headers);
  return headers;
}

export function captureTraceCarrier(): Record<string, string> {
  const carrier: Record<string, string> = {};
  propagation.inject(context.active(), carrier);
  return carrier;
}

export function withTraceCarrier<T>(carrier: Record<string, string> | undefined, fn: () => T): T {
  if (!carrier || !carrier.traceparent) return fn();
  return context.with(propagation.extract(context.active(), carrier), fn);
}

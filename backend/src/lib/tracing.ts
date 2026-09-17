import {
  AlwaysOnSampler,
  BatchSpanProcessor,
  ConsoleSpanExporter,
  NodeTracerProvider,
  ParentBasedSampler,
  SamplingDecision,
  TraceIdRatioBasedSampler,
  type Sampler,
  type SamplingResult,
} from '@opentelemetry/sdk-trace-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';
import { trace, type Context, type SpanKind, type Attributes, type Link } from '@opentelemetry/api';

const ALWAYS: SamplingResult = { decision: SamplingDecision.RECORD_AND_SAMPLED };
const httpRatio = new TraceIdRatioBasedSampler(0.1);

/** 100% of agent/job/webhook/LLM work. 10% of ordinary HTTP. Local/test stay AlwaysOn. */
export class GrowthRootSampler implements Sampler {
  shouldSample(
    context: Context,
    traceId: string,
    spanName: string,
    spanKind: SpanKind,
    attributes: Attributes,
    links: Link[],
  ): SamplingResult {
    if (
      spanName.startsWith('bullmq.') ||
      spanName.startsWith('langgraph.') ||
      spanName.startsWith('llm.') ||
      spanName.includes('/agents') ||
      spanName.includes('/internal') ||
      spanName.includes('/webhooks') ||
      spanName.includes('/campaigns') ||
      spanName.includes('/ingestion')
    ) {
      return ALWAYS;
    }
    if (/^(GET|POST|PUT|PATCH|DELETE) /.test(spanName)) {
      return httpRatio.shouldSample(context, traceId);
    }
    return ALWAYS;
  }
}

/**
 * Manual spans, not auto-instrumentation. `render.yaml`'s build bundles the
 * whole backend into one file with esbuild; OTel's auto-instrumentation
 * packages work by monkey-patching `require()` calls before a module is
 * first loaded, which cannot see anything esbuild has already inlined —
 * they would silently instrument nothing in this specific build. Manual
 * `tracer.startActiveSpan()` calls (this file's callers) work regardless of
 * bundling, since they're just function calls in code that already ran.
 *
 * No `OTEL_EXPORTER_OTLP_ENDPOINT` set: spans still work (a no-op export
 * means every `startActiveSpan` call succeeds and costs nothing at
 * runtime), they just don't leave the process — the ConsoleSpanExporter
 * makes them visible during local development without any setup.
 */
export function parseOtelHeaders(raw: string | undefined): Record<string, string> | undefined {
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

  const sampler =
    process.env.NODE_ENV === 'production'
      ? new ParentBasedSampler({ root: new GrowthRootSampler() })
      : new AlwaysOnSampler();

  const provider = new NodeTracerProvider({
    resource: resourceFromAttributes({
      [ATTR_SERVICE_NAME]: 'growthos-backend',
      [ATTR_SERVICE_VERSION]: process.env.RENDER_GIT_COMMIT ?? 'local',
    }),
    spanProcessors: [new BatchSpanProcessor(exporter)],
    sampler,
  });

  provider.register();

  const shutdown = () => {
    void provider.shutdown();
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

export const tracer = trace.getTracer('growthos-backend');

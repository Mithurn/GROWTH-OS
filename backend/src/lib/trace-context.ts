import { context, propagation } from '@opentelemetry/api';

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

export function headersCarrier(headers: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(headers)) {
    if (typeof v === 'string') out[k] = v;
    else if (Array.isArray(v) && typeof v[0] === 'string') out[k] = v[0];
  }
  return out;
}

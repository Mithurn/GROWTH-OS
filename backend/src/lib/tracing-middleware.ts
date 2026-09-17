import type { Request, Response, NextFunction } from 'express';
import { context, propagation, SpanStatusCode, trace } from '@opentelemetry/api';
import { tracer } from './tracing';
import { headersCarrier } from './trace-context';

/** One span per HTTP request. Route pattern (not the raw URL) once Express has matched it, so /api/campaigns/:id doesn't fragment into one span name per id. */
export function tracingMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (req.path.startsWith('/health')) {
    next();
    return;
  }
  const parent = propagation.extract(context.active(), headersCarrier(req.headers as Record<string, unknown>));
  const span = tracer.startSpan(
    `${req.method} ${req.path}`,
    {
      attributes: {
        'http.method': req.method,
        'http.target': req.originalUrl,
      },
    },
    parent,
  );

  const { traceId, spanId } = span.spanContext();
  res.setHeader('x-request-id', traceId);
  res.setHeader('traceparent', `00-${traceId}-${spanId}-01`);

  res.on('finish', () => {
    span.setAttribute('http.status_code', res.statusCode);
    const route = req.route?.path as string | undefined;
    if (route) span.updateName(`${req.method} ${route}`);
    if (res.statusCode >= 500) {
      span.setStatus({ code: SpanStatusCode.ERROR });
    }
    span.end();
  });

  context.with(trace.setSpan(parent, span), () => next());
}

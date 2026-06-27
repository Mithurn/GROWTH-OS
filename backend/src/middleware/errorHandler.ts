import type { Request, Response, NextFunction } from 'express';
import { logger } from '../lib/logger';

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const reqId = res.getHeader('x-request-id') as string | undefined;

  if (err instanceof Error) {
    logger.error({ err, reqId, path: req.path, method: req.method }, 'Unhandled error');
    res.status(500).json({ error: 'Internal server error', reqId });
  } else {
    logger.error({ err, reqId, path: req.path, method: req.method }, 'Unhandled non-Error throw');
    res.status(500).json({ error: 'Internal server error', reqId });
  }
}

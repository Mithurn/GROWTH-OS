import type { Request, Response, NextFunction } from 'express';
import { MulterError } from 'multer';
import { logger } from '../lib/logger';
import { captureException } from '../lib/sentry';

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const reqId = res.getHeader('x-request-id') as string | undefined;

  // Upload problems are client errors. Without this they surface as 500s, which
  // tells the user nothing and pollutes error monitoring.
  if (err instanceof MulterError) {
    const message =
      err.code === 'LIMIT_FILE_SIZE'
        ? 'File is too large. The maximum upload size is 10 MB.'
        : err.code === 'LIMIT_FILE_COUNT' || err.code === 'LIMIT_UNEXPECTED_FILE'
          ? 'Unexpected file upload.'
          : 'Upload rejected.';

    logger.warn({ code: err.code, reqId, path: req.path }, 'Upload rejected');
    res.status(400).json({ error: message, reqId });
    return;
  }

  if (err instanceof Error && err.message === 'Only CSV files are accepted') {
    logger.warn({ reqId, path: req.path }, 'Non-CSV upload rejected');
    res.status(400).json({ error: err.message, reqId });
    return;
  }

  if (err instanceof Error) {
    logger.error({ err, reqId, path: req.path, method: req.method }, 'Unhandled error');
    captureException(err, { reqId, path: req.path, method: req.method });
    res.status(500).json({ error: 'Internal server error', reqId });
  } else {
    logger.error({ err, reqId, path: req.path, method: req.method }, 'Unhandled non-Error throw');
    captureException(err, { reqId, path: req.path, method: req.method });
    res.status(500).json({ error: 'Internal server error', reqId });
  }
}

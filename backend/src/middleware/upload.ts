import multer from 'multer';
import type { RequestHandler } from 'express';
import { getConfig } from '../lib/config';

/**
 * multer's `limits`/`fileFilter` are fixed at construction, not resolvable
 * per-request the way express-rate-limit's function-based options are — so
 * this reads global config once (memoized) rather than per-tenant.
 * ponytail: a global ceiling, not a plan lever. Upgrade to a per-tenant limit
 * only if a real plan tier needs a different upload cap; until then this is
 * a safety bound on the process, not a billing lever.
 */
let cached: multer.Multer | null = null;
let building: Promise<multer.Multer> | null = null;

async function buildUploader(): Promise<multer.Multer> {
  const [maxBytes, maxFiles] = await Promise.all([
    getConfig(null, 'upload.max_bytes'),
    getConfig(null, 'upload.max_files'),
  ]);

  return multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: maxBytes, files: maxFiles },
    fileFilter: (_req, file, cb) => {
      // Browsers are inconsistent about the MIME type they attach to a .csv, so the
      // extension is accepted as a fallback rather than trusted on its own.
      const isCsv =
        file.mimetype === 'text/csv' ||
        file.mimetype === 'application/vnd.ms-excel' ||
        file.mimetype === 'application/octet-stream' ||
        file.originalname.toLowerCase().endsWith('.csv');

      if (!isCsv) return cb(new Error('Only CSV files are accepted'));
      cb(null, true);
    },
  });
}

async function getUploader(): Promise<multer.Multer> {
  if (cached) return cached;
  building ??= buildUploader().then((built) => {
    cached = built;
    return built;
  });
  return building;
}

function lazy(method: 'single' | 'fields', arg: string | multer.Field[]): RequestHandler {
  return (req, res, next) => {
    getUploader()
      .then((multerInstance) => {
        const handler =
          method === 'single'
            ? multerInstance.single(arg as string)
            : multerInstance.fields(arg as multer.Field[]);
        handler(req, res, next);
      })
      .catch(next);
  };
}

export const upload = {
  single: (fieldName: string) => lazy('single', fieldName),
  fields: (fields: multer.Field[]) => lazy('fields', fields),
};

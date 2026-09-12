import multer from 'multer';

/**
 * 10 MB is comfortably above the demo dataset (~200 KB) and well below anything that
 * would exhaust the 512 MB free-tier instance while parsing in memory.
 */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES, files: 2 },
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

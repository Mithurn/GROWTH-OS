import { readFile } from 'fs/promises';
import path from 'path';
import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';
import {
  requireAuth,
  resolveCompanyMiddleware,
  requireCompanyOwnership,
  type AuthRequest,
} from '../middleware/auth';
import { uploadLimiter } from '../middleware/rate-limits';
import { upload } from '../middleware/upload';
import { parseCSV, startIngestionJob } from '../services/ingestion';

export const ingestionRouter = Router();

/** Demo CSVs committed alongside the backend, used by the sample-data path. */
const DEMO_DATA_DIR = path.resolve(process.cwd(), 'generated-data');

/** Validation preview only — writes nothing. */
ingestionRouter.post(
  '/upload/customers',
  requireAuth,
  uploadLimiter,
  upload.single('file'),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      const customers = await parseCSV(req.file.buffer);
      const columns = customers.length > 0 ? Object.keys(customers[0]) : [];

      res.json({
        success: true,
        preview: {
          totalCustomers: customers.length,
          columns,
          sampleRows: customers.slice(0, 3),
        },
      });
    } catch (error) {
      logger.error({ err: error }, 'Error parsing customer CSV');
      res.status(500).json({ error: 'Failed to parse customer CSV' });
    }
  },
);

/** Validation preview only — writes nothing. */
ingestionRouter.post(
  '/upload/orders',
  requireAuth,
  uploadLimiter,
  upload.single('file'),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      const orders = await parseCSV(req.file.buffer);

      const dates = orders
        .map((o) => o.order_date)
        .filter(Boolean)
        .sort();

      const dateRange =
        dates.length > 0
          ? { start: dates[0].substring(0, 7), end: dates[dates.length - 1].substring(0, 7) }
          : null;

      res.json({
        success: true,
        preview: {
          totalOrders: orders.length,
          dateRange,
          sampleRows: orders.slice(0, 3),
        },
      });
    } catch (error) {
      logger.error({ err: error }, 'Error parsing orders CSV');
      res.status(500).json({ error: 'Failed to parse orders CSV' });
    }
  },
);

ingestionRouter.post(
  '/process-ingestion',
  requireAuth,
  resolveCompanyMiddleware,
  uploadLimiter,
  upload.fields([
    { name: 'customers', maxCount: 1 },
    { name: 'orders', maxCount: 1 },
  ]),
  async (req: AuthRequest, res) => {
    try {
      const files = req.files as { [fieldname: string]: Express.Multer.File[] };

      if (!files.customers || !files.orders) {
        return res.status(400).json({ error: 'Both customer and order files required' });
      }

      const sessionId = await startIngestionJob(
        req.companyId!,
        files.customers[0].buffer,
        files.orders[0].buffer,
      );

      res.json({ success: true, sessionId });
    } catch (error) {
      logger.error({ err: error }, 'Error starting ingestion');
      res.status(500).json({ error: 'Failed to start ingestion' });
    }
  },
);

/**
 * Runs the same pipeline as a real upload, against the demo CSVs in the repo, seeded
 * into the caller's own company. The frontend used to fake this with a progress
 * animation and a hardcoded company id in localStorage — which the backend ignores,
 * since tenancy comes from the JWT — so the demo always landed on an empty dashboard.
 */
ingestionRouter.post(
  '/onboarding/demo-seed',
  requireAuth,
  resolveCompanyMiddleware,
  async (req: AuthRequest, res) => {
    try {
      const [customerBuffer, orderBuffer] = await Promise.all([
        readFile(path.join(DEMO_DATA_DIR, 'customers.csv')),
        readFile(path.join(DEMO_DATA_DIR, 'orders.csv')),
      ]);

      const sessionId = await startIngestionJob(req.companyId!, customerBuffer, orderBuffer);

      res.json({ success: true, sessionId });
    } catch (error) {
      logger.error({ err: error, dir: DEMO_DATA_DIR }, 'Error seeding demo data');
      res.status(500).json({ error: 'Failed to seed demo data' });
    }
  },
);

ingestionRouter.get(
  '/ingestion-status/:sessionId',
  requireAuth,
  resolveCompanyMiddleware,
  requireCompanyOwnership('ingestion_sessions', 'sessionId'),
  async (req: AuthRequest, res) => {
    try {
      const sessionId = req.params['sessionId'] as string;
      const session = await prisma.ingestionSession.findUnique({ where: { id: sessionId } });
      if (!session) return res.json({ step: 'not_found', progress: 0 });
      res.json({
        step: session.step,
        progress: session.progress,
        message: session.step,
        status: session.status,
        error: session.errorMessage,
      });
    } catch (error) {
      logger.error({ err: error }, 'Error fetching ingestion status');
      res.status(500).json({ error: 'Failed to fetch ingestion status' });
    }
  },
);

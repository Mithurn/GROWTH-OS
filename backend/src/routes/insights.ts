import { Router } from 'express';
import { logger } from '../lib/logger';
import { prisma } from '../lib/prisma';
import { requireAuth, resolveCompanyMiddleware, type AuthRequest } from '../middleware/auth';

export const insightsRouter = Router();

const ACTIVE_WITHIN_DAYS = 30;
const AT_RISK_WITHIN_DAYS = 90;

insightsRouter.get(
  '/intelligence-preview',
  requireAuth,
  resolveCompanyMiddleware,
  async (req: AuthRequest, res) => {
    try {
      const companyId = req.companyId!;

      const [totalCustomers, orders, metrics] = await Promise.all([
        prisma.customer.count({ where: { companyId } }),
        prisma.order.findMany({ where: { companyId }, select: { totalAmount: true } }),
        prisma.customerMetrics.findMany({
          where: { companyId },
          select: { customerId: true, totalSpent: true, daysSinceLastOrder: true },
        }),
      ]);

      if (totalCustomers === 0) {
        return res.json({
          totalCustomers: 0,
          totalOrders: 0,
          revenue: 0,
          avgOrderValue: 0,
          customerHealth: { active: 0, dormant: 0, atRisk: 0 },
          topCustomers: [],
        });
      }

      const totalOrders = orders.length;
      const revenue = orders.reduce((sum, o) => sum + Number(o.totalAmount), 0);
      const avgOrderValue = totalOrders ? revenue / totalOrders : 0;

      let active = 0;
      let atRisk = 0;
      let dormant = 0;
      for (const row of metrics) {
        const days = row.daysSinceLastOrder ?? Infinity;
        if (days <= ACTIVE_WITHIN_DAYS) active++;
        else if (days <= AT_RISK_WITHIN_DAYS) atRisk++;
        else dormant++;
      }

      const topMetrics = [...metrics]
        .sort((a, b) => Number(b.totalSpent) - Number(a.totalSpent))
        .slice(0, 3);

      const names = await prisma.customer.findMany({
        where: { id: { in: topMetrics.map((m) => m.customerId) }, companyId },
        select: { id: true, firstName: true, lastName: true },
      });
      const nameById = new Map(names.map((c) => [c.id, `${c.firstName} ${c.lastName ?? ''}`.trim()]));

      res.json({
        totalCustomers,
        totalOrders,
        revenue,
        avgOrderValue,
        customerHealth: { active, dormant, atRisk },
        topCustomers: topMetrics.map((m) => ({
          name: nameById.get(m.customerId) ?? 'Unknown',
          totalSpent: m.totalSpent,
        })),
      });
    } catch (error) {
      logger.error({ err: error }, 'Error fetching intelligence');
      res.status(500).json({ error: 'Failed to fetch intelligence' });
    }
  },
);

import { Router } from 'express';
import { supabase } from '../lib/supabase';
import { logger } from '../lib/logger';
import { selectIn } from '../lib/scoped-query';
import { requireAuth, resolveCompanyMiddleware, type AuthRequest } from '../middleware/auth';

export const insightsRouter = Router();

/** Health buckets, in days since last order. */
const ACTIVE_WITHIN_DAYS = 30;
const AT_RISK_WITHIN_DAYS = 90;

/**
 * Headline counts for the post-ingestion preview screen.
 *
 * `orders`, `customer_metrics` and `customer_attributes` carry no `company_id` of their
 * own — their tenant is implied by the customer they belong to — so everything here is
 * scoped by first resolving the company's customer ids.
 *
 * These filters previously passed a query builder straight into `.in()`, e.g.
 * `.in('customer_id', supabase.from('customers').select('id')... as any)`. supabase-js
 * has no subquery support: `.in()` is serialized into the URL, so the builder was
 * stringified and the filter never matched the intended rows.
 */
insightsRouter.get(
  '/intelligence-preview',
  requireAuth,
  resolveCompanyMiddleware,
  async (req: AuthRequest, res) => {
    try {
      const companyId = req.companyId!;

      const { data: customerRows, error: customerError } = await supabase
        .from('customers')
        .select('id')
        .eq('company_id', companyId);

      if (customerError) throw customerError;

      const customerIds = (customerRows ?? []).map((c) => c.id as string);
      const totalCustomers = customerIds.length;

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

      const [orders, metrics] = await Promise.all([
        selectIn<{ total_amount: number | string }>(
          supabase,
          'orders',
          'total_amount',
          'customer_id',
          customerIds,
        ),
        selectIn<{
          customer_id: string;
          total_spent: number | string | null;
          days_since_last_order: number | null;
        }>(
          supabase,
          'customer_metrics',
          'customer_id, total_spent, days_since_last_order',
          'customer_id',
          customerIds,
        ),
      ]);

      const totalOrders = orders.length;
      const revenue = orders.reduce((sum, o) => sum + parseFloat(String(o.total_amount ?? 0)), 0);
      const avgOrderValue = totalOrders ? revenue / totalOrders : 0;

      let active = 0;
      let atRisk = 0;
      let dormant = 0;
      for (const row of metrics) {
        // A customer with no recorded order is dormant, not active.
        const days = row.days_since_last_order ?? Infinity;
        if (days <= ACTIVE_WITHIN_DAYS) active++;
        else if (days <= AT_RISK_WITHIN_DAYS) atRisk++;
        else dormant++;
      }

      const topMetrics = [...metrics]
        .sort((a, b) => parseFloat(String(b.total_spent ?? 0)) - parseFloat(String(a.total_spent ?? 0)))
        .slice(0, 3);

      const names = await selectIn<{ id: string; first_name: string; last_name: string }>(
        supabase,
        'customers',
        'id, first_name, last_name',
        'id',
        topMetrics.map((m) => m.customer_id),
      );
      const nameById = new Map(names.map((c) => [c.id, `${c.first_name} ${c.last_name}`]));

      res.json({
        totalCustomers,
        totalOrders,
        revenue,
        avgOrderValue,
        customerHealth: { active, dormant, atRisk },
        topCustomers: topMetrics.map((m) => ({
          name: nameById.get(m.customer_id) ?? 'Unknown',
          totalSpent: m.total_spent,
        })),
      });
    } catch (error) {
      logger.error({ err: error }, 'Error fetching intelligence');
      res.status(500).json({ error: 'Failed to fetch intelligence' });
    }
  },
);

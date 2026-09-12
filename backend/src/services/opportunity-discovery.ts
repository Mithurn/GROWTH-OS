import { createHash } from 'crypto';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { openRouterConfig, openai } from '../config/openrouter';
import { logger } from '../lib/logger';
import { getSegmentCache, setSegmentCache } from '../lib/redis';
import { parseWithRetry } from '../lib/ai';
import {
  OPPORTUNITY_TYPES as OPPORTUNITY_TYPE_ENUM,
  toPrismaWhere,
  type OpportunityType,
} from '@growthos/domain';

// ── OpenRouter client with required headers ───────────────────────────────────

const DiscoveredOpportunityRawSchema = z.object({
  opportunity_key: z.string(),
  opportunity_type: z.enum(['Retention-Churn', 'Retention-VIP', 'Upsell', 'Reactivation']),
  title: z.string(),
  description: z.string(),
  audience_size: z.number(),
  potential_revenue: z.number(),
  confidence_score: z.number(),
  priority_score: z.number(),
  supporting_customer_segment: z.string(),
  recommended_action: z.string(),
  trigger_reason: z.string(),
  ai_summary: z.string(),
  ai_reasoning: z.string(),
});
const DiscoveredOpportunityArraySchema = z.array(DiscoveredOpportunityRawSchema);

interface DiscoveredOpportunity {
  id: string;
  potentialRevenue: number;
  audienceSize: number;
}

/**
 * Discover new revenue opportunities by analyzing customer data.
 */
export async function discoverOpportunities(
  companyId: string,
  agentId: string,
  goal: string,
): Promise<DiscoveredOpportunity[]> {
  logger.info({ companyId }, 'Discovering opportunities');

  try {
    const analytics = await getCustomerAnalytics(companyId);

    if (!analytics || analytics.totalCustomers === 0) {
      logger.info('No customer data available for opportunity analysis');
      return [];
    }

    // Segment cache: skip LLM if we've already computed opportunities for this
    // exact analytics snapshot + goal within the last 15 minutes
    const cacheHash = createHash('sha256')
      .update(JSON.stringify(analytics) + goal)
      .digest('hex')
      .slice(0, 16);

    const cached = await getSegmentCache(cacheHash);
    if (cached) {
      logger.info({ cacheHash }, 'OpportunityDiscovery: cache hit, skipping LLM call');
      return JSON.parse(cached) as DiscoveredOpportunity[];
    }

    const result = await analyzeWithAI(companyId, agentId, goal, analytics);
    await setSegmentCache(cacheHash, JSON.stringify(result));
    return result;
  } catch (error) {
    logger.error({ err: error }, 'Error in opportunity discovery');
    return [];
  }
}

// ── Analytics snapshot for the AI prompt ──────────────────────────────────────
async function getCustomerAnalytics(companyId: string) {
  try {
    // customer_metrics and customer_attributes have no company_id of their own, so
    // every count here is scoped through the customer relation. These were previously
    // unscoped, which fed one tenant's totals into another tenant's agent prompt and
    // audience sizing.
    const ownedByCompany = { customer: { companyId } };

    const totalCustomers = await prisma.customer.count({ where: { companyId } });

    if (totalCustomers === 0) return null;

    const [
      churnRiskCustomers,
      vipCustomers,
      dormantCustomers,
      lowEngagementCustomers,
      categoryAffinityData,
      averageMetrics,
      personaData,
    ] = await Promise.all([
      // Retention-Churn: inactive 30–59 days
      prisma.customerMetrics.count({
        where: { ...ownedByCompany, daysSinceLastOrder: { gte: 30, lt: 60 } },
      }),

      // Retention-VIP: high spenders inactive 15+ days
      prisma.customerMetrics.count({
        where: { ...ownedByCompany, totalSpent: { gte: 5000 }, daysSinceLastOrder: { gte: 15 } },
      }),

      // Reactivation: dormant 60+ days
      prisma.customerMetrics.count({
        where: { ...ownedByCompany, daysSinceLastOrder: { gte: 60 } },
      }),

      // Upsell: repeat buyers with low AOV
      prisma.customerMetrics.count({
        where: { ...ownedByCompany, totalOrders: { gte: 3 }, avgOrderValue: { lte: 2000 } },
      }),

      prisma.customerAttributes.groupBy({
        by: ['favoriteCategory'],
        where: ownedByCompany,
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 10,
      }),

      prisma.customerMetrics.aggregate({
        where: ownedByCompany,
        _avg: { totalSpent: true, avgOrderValue: true, totalOrders: true },
      }),

      prisma.persona.groupBy({
        by: ['personaName', 'personaDescription'],
        where: { companyId },
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 5,
      }),
    ]);

    return {
      totalCustomers,
      churnRiskCustomers,
      vipCustomers,
      dormantCustomers,
      lowEngagementCustomers,
      topCategories: categoryAffinityData,
      avgSpend: averageMetrics._avg.totalSpent || 0,
      avgOrderValue: averageMetrics._avg.avgOrderValue || 0,
      avgOrders: averageMetrics._avg.totalOrders || 0,
      personas: personaData.map((p: { personaName: string; personaDescription: string | null; _count: { id: number } }) => ({
        name: p.personaName,
        description: p.personaDescription,
        count: p._count.id,
      })),
    };
  } catch (error) {
    logger.error({ err: error }, 'Error getting customer analytics');
    throw error;
  }
}

// ── AI analysis ───────────────────────────────────────────────────────────────
async function analyzeWithAI(
  companyId: string,
  agentId: string,
  goal: string,
  analytics: any,
): Promise<DiscoveredOpportunity[]> {
  try {
    const prompt = `You are an AI growth agent analyzing customer data to discover revenue opportunities.

AGENT GOAL: ${goal}

CUSTOMER DATA:
- Total Customers: ${analytics.totalCustomers}
- At Churn Risk (30–59 days inactive): ${analytics.churnRiskCustomers}
- VIP Customers (₹5000+ spent, inactive 15+ days): ${analytics.vipCustomers}
- Dormant Customers (60+ days inactive): ${analytics.dormantCustomers}
- Upsell Candidates (3+ orders, AOV ≤ ₹2000): ${analytics.lowEngagementCustomers}
- Average Customer Spend: ₹${Math.round(analytics.avgSpend)}
- Average Order Value: ₹${Math.round(analytics.avgOrderValue)}
- Average Orders per Customer: ${Number(analytics.avgOrders).toFixed(1)}

Top Product Categories:
${analytics.topCategories.map((c: any) => `- ${c.favoriteCategory}: ${c._count.id} customers`).join('\n')}

${analytics.personas && analytics.personas.length > 0 ? `Customer Personas:\n${analytics.personas.map((p: any) => `- ${p.name} (${p.count} customers): ${p.description}`).join('\n')}` : ''}

Identify 2–3 high-impact opportunities aligned with the goal.

CRITICAL RULE: opportunity_type MUST be EXACTLY one of these four strings — no variations, no synonyms:
- "Retention-Churn"  → targets customers inactive 30–59 days
- "Retention-VIP"    → targets VIP customers (₹5000+ spent) inactive 15+ days
- "Upsell"           → targets repeat buyers (3+ orders) with low average order value
- "Reactivation"     → targets dormant customers inactive 60+ days

For each opportunity provide:
1. opportunity_key: unique snake_case identifier
2. opportunity_type: MUST be one of the four strings above, exactly
3. title: action-oriented title
4. description: 2–3 sentences explaining the opportunity
5. audience_size: realistic estimate based on the data above
6. potential_revenue: conservative rupee estimate
7. confidence_score: 0–100
8. priority_score: 0–100
9. supporting_customer_segment: short label for the target segment
10. recommended_action: specific action (mention channel: WhatsApp / Email / SMS)
11. trigger_reason: why this opportunity exists now
12. ai_summary: one-sentence summary
13. ai_reasoning: why you prioritised this

Respond ONLY with a valid JSON array. No markdown, no explanation outside the JSON.`;

    const opportunitiesData = await parseWithRetry(
      () => openai.chat.completions.create({
        model: openRouterConfig.defaultModel,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.5,
        max_tokens: 2000,
      }).then(r => r.choices[0]?.message?.content ?? ''),
      DiscoveredOpportunityArraySchema,
    );

    const createdOpportunities: DiscoveredOpportunity[] = [];

    for (const oppData of opportunitiesData) {
      try {
        const existing = await prisma.opportunity.findFirst({
          where: { companyId, opportunityKey: oppData.opportunity_key },
        });

        if (existing) {
          logger.info({ key: oppData.opportunity_key }, 'Opportunity already exists, skipping');
          continue;
        }

        const audienceSize = await getAudienceSize(
          oppData.opportunity_type as OpportunityType,
          companyId,
        );

        const opportunity = await prisma.opportunity.create({
          data: {
            companyId,
            agentId,
            opportunityKey: oppData.opportunity_key,
            opportunityType: oppData.opportunity_type,
            title: oppData.title,
            description: oppData.description,
            audienceSize: audienceSize > 0 ? audienceSize : oppData.audience_size,
            potentialRevenue: oppData.potential_revenue,
            confidenceScore: oppData.confidence_score,
            priorityScore: oppData.priority_score,
            supportingCustomerSegment: oppData.supporting_customer_segment,
            recommendedAction: oppData.recommended_action,
            audienceDefinition: {
              type: oppData.opportunity_type,
              segment: oppData.supporting_customer_segment,
            },
            triggerReason: oppData.trigger_reason,
            aiSummary: oppData.ai_summary,
            aiReasoning: oppData.ai_reasoning,
            status: 'Detected',
          },
        });

        const audienceCustomerIds = await getAudienceCustomers(
          oppData.opportunity_type as OpportunityType,
          companyId,
          audienceSize > 0 ? audienceSize : oppData.audience_size,
        );

        if (audienceCustomerIds.length > 0) {
          await prisma.opportunityCustomer.createMany({
            data: audienceCustomerIds.map(customerId => ({
              opportunityId: opportunity.id,
              customerId,
            })),
            skipDuplicates: true,
          });
        }

        createdOpportunities.push({
          id: opportunity.id,
          potentialRevenue: Number(opportunity.potentialRevenue),
          audienceSize: opportunity.audienceSize,
        });

        logger.info({ title: oppData.title, customers: audienceCustomerIds.length, revenue: oppData.potential_revenue }, 'Opportunity created');
      } catch (error) {
        logger.error({ err: error, key: oppData.opportunity_key }, 'Error creating opportunity');
      }
    }

    return createdOpportunities;
  } catch (error) {
    logger.error({ err: error }, 'Error in AI analysis');
    return [];
  }
}

// ── Audience predicates ───────────────────────────────────────────────────────
// Single source of truth for what each opportunity type targets now lives in
// @growthos/domain (packages/domain/src/segments/audience.ts) — a model must never
// define who receives a message, and this is what "audience sizing is code, not a
// prompt" means in practice. See docs/ARCHITECTURE_V2.md §5.
type AudiencePredicate = NonNullable<
  Parameters<typeof prisma.customerMetrics.count>[0]
>['where'];

function audiencePredicate(
  opportunityType: OpportunityType,
  companyId: string,
): AudiencePredicate | null {
  try {
    return toPrismaWhere(opportunityType, companyId) as AudiencePredicate;
  } catch (error) {
    logger.error({ err: error, opportunityType }, 'opportunity-discovery: unhandled opportunity type');
    return null;
  }
}

async function getAudienceSize(
  opportunityType: OpportunityType,
  companyId: string,
): Promise<number> {
  const where = audiencePredicate(opportunityType, companyId);
  if (!where) return 0;

  try {
    return await prisma.customerMetrics.count({ where });
  } catch (error) {
    logger.error({ err: error }, 'Error getting audience size');
    return 0;
  }
}

async function getAudienceCustomers(
  opportunityType: OpportunityType,
  companyId: string,
  limit: number,
): Promise<string[]> {
  const where = audiencePredicate(opportunityType, companyId);
  if (!where) return [];

  try {
    const rows = await prisma.customerMetrics.findMany({
      where,
      select: { customerId: true },
      take: limit,
    });

    return rows.map(r => r.customerId);
  } catch (error) {
    logger.error({ err: error }, 'Error getting audience customers');
    return [];
  }
}

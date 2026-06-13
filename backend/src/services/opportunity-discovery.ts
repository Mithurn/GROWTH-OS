import { prisma } from '../lib/prisma';
import OpenAI from 'openai';

// Initialize OpenAI client with OpenRouter
const openai = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY,
});

interface DiscoveredOpportunity {
  id: string;
  potentialRevenue: number;
  audienceSize: number;
}

/**
 * Discover new revenue opportunities by analyzing customer data
 * This is the AI brain that finds patterns and segments
 */
export async function discoverOpportunities(
  companyId: string,
  agentId: string,
  goal: string
): Promise<DiscoveredOpportunity[]> {
  console.log(`🔍 Discovering opportunities for company ${companyId}`);

  try {
    // Get customer analytics data
    const analytics = await getCustomerAnalytics(companyId);

    if (!analytics || analytics.totalCustomers === 0) {
      console.log('No customer data available for analysis');
      return [];
    }

    // Use AI to analyze patterns and discover opportunities
    const opportunities = await analyzeWithAI(companyId, agentId, goal, analytics);

    return opportunities;
  } catch (error) {
    console.error('Error in opportunity discovery:', error);
    return [];
  }
}

/**
 * Get customer analytics for AI analysis
 */
async function getCustomerAnalytics(companyId: string) {
  try {
    // Get total customers
    const totalCustomers = await prisma.customer.count();

    if (totalCustomers === 0) {
      return null;
    }

    // Get customer segments data
    const [
      churnRiskCustomers,
      vipCustomers,
      lowEngagementCustomers,
      categoryAffinityData,
      averageMetrics,
      personaData
    ] = await Promise.all([
      // Churn risk: customers who haven't ordered in 30+ days
      prisma.customerMetrics.count({
        where: {
          daysSinceLastOrder: { gte: 30 }
        }
      }),

      // VIP customers: high spenders (top 20%)
      prisma.customerMetrics.count({
        where: {
          totalSpent: { gte: 5000 }
        }
      }),

      // Low engagement: customers with low engagement score
      prisma.customerMetrics.count({
        where: {
          engagementScore: { lte: 30 }
        }
      }),

      // Category affinity analysis
      prisma.customerAttributes.groupBy({
        by: ['favoriteCategory'],
        _count: {
          id: true
        },
        orderBy: {
          _count: {
            id: 'desc'
          }
        },
        take: 10
      }),

      // Average metrics
      prisma.customerMetrics.aggregate({
        _avg: {
          totalSpent: true,
          avgOrderValue: true,
          totalOrders: true
        }
      }),

      // Persona distribution
      prisma.persona.groupBy({
        by: ['personaName', 'personaDescription'],
        where: {
          companyId
        },
        _count: {
          id: true
        },
        orderBy: {
          _count: {
            id: 'desc'
          }
        },
        take: 5
      })
    ]);

    return {
      totalCustomers,
      churnRiskCustomers,
      vipCustomers,
      lowEngagementCustomers,
      topCategories: categoryAffinityData,
      avgSpend: averageMetrics._avg.totalSpent || 0,
      avgOrderValue: averageMetrics._avg.avgOrderValue || 0,
      avgOrders: averageMetrics._avg.totalOrders || 0,
      personas: personaData.map(p => ({
        name: p.personaName,
        description: p.personaDescription,
        count: p._count.id
      }))
    };
  } catch (error) {
    console.error('Error getting customer analytics:', error);
    throw error;
  }
}

/**
 * Use AI to analyze customer data and discover opportunities
 */
async function analyzeWithAI(
  companyId: string,
  agentId: string,
  goal: string,
  analytics: any
): Promise<DiscoveredOpportunity[]> {
  try {
    const prompt = `You are an AI growth agent analyzing customer data to discover revenue opportunities.

AGENT GOAL: ${goal}

CUSTOMER DATA ANALYSIS:
- Total Customers: ${analytics.totalCustomers}
- Customers at Churn Risk (30+ days inactive): ${analytics.churnRiskCustomers}
- VIP Customers (₹5000+ spent): ${analytics.vipCustomers}
- Low Engagement Customers: ${analytics.lowEngagementCustomers}
- Average Customer Spend: ₹${Math.round(analytics.avgSpend)}
- Average Order Value: ₹${Math.round(analytics.avgOrderValue)}
- Average Orders per Customer: ${analytics.avgOrders?.toFixed(1)}

Top Product Categories:
${analytics.topCategories.map((c: any) => `- ${c.favoriteCategory}: ${c._count.id} customers`).join('\n')}

${analytics.personas && analytics.personas.length > 0 ? `
Customer Personas (AI-generated segments):
${analytics.personas.map((p: any) => `- ${p.name} (${p.count} customers): ${p.description}`).join('\n')}
` : ''}

Based on this data, identify 2-3 HIGH-IMPACT revenue opportunities that align with the goal. Use the persona data to create more targeted and personalized opportunities.

For each opportunity, provide:
1. opportunity_key: unique identifier (e.g., "vip_winback_2024")
2. opportunity_type: category (e.g., "Retention", "Upsell", "Reactivation")
3. title: clear, action-oriented title (e.g., "Re-engage VIP Customers")
4. description: 2-3 sentences explaining the opportunity
5. audience_size: estimated number of customers (be realistic based on data)
6. potential_revenue: estimated revenue in rupees (be conservative)
7. confidence_score: 0-100 based on data strength
8. priority_score: 0-100 based on impact vs effort
9. supporting_customer_segment: description of target segment
10. recommended_action: specific action to take
11. trigger_reason: why this opportunity exists now
12. ai_summary: 1 sentence summary of the opportunity
13. ai_reasoning: why you discovered this opportunity

Respond ONLY with valid JSON array. No markdown, no explanation.

Example format:
[
  {
    "opportunity_key": "churn_prevention_high_value",
    "opportunity_type": "Retention",
    "title": "Prevent VIP Customer Churn",
    "description": "Identify and re-engage high-value customers showing early churn signals.",
    "audience_size": 150,
    "potential_revenue": 75000,
    "confidence_score": 85,
    "priority_score": 92,
    "supporting_customer_segment": "VIP customers (₹5000+ spend) inactive for 15-30 days",
    "recommended_action": "Send personalized win-back offer via WhatsApp",
    "trigger_reason": "Detected ${analytics.churnRiskCustomers} customers at churn risk",
    "ai_summary": "Re-engage high-value customers before they churn completely",
    "ai_reasoning": "Early intervention with VIPs has higher success rate and prevents significant revenue loss"
  }
]`;

    const response = await openai.chat.completions.create({
      model: 'anthropic/claude-3.5-sonnet',
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 2000
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      console.log('No response from AI');
      return [];
    }

    // Parse AI response
    const opportunitiesData = JSON.parse(content);

    // Create opportunities in database
    const createdOpportunities: DiscoveredOpportunity[] = [];

    for (const oppData of opportunitiesData) {
      try {
        // Check if opportunity already exists
        const existing = await prisma.opportunity.findFirst({
          where: {
            companyId,
            opportunityKey: oppData.opportunity_key
          }
        });

        if (existing) {
          console.log(`Opportunity ${oppData.opportunity_key} already exists`);
          continue;
        }

        // Get actual customer count for the segment
        const audienceSize = await getAudienceSize(oppData.opportunity_type, oppData.supporting_customer_segment);

        const opportunity = await prisma.opportunity.create({
          data: {
            companyId,
            agentId,
            opportunityKey: oppData.opportunity_key,
            opportunityType: oppData.opportunity_type,
            title: oppData.title,
            description: oppData.description,
            audienceSize: audienceSize || oppData.audience_size,
            potentialRevenue: oppData.potential_revenue,
            confidenceScore: oppData.confidence_score,
            priorityScore: oppData.priority_score,
            supportingCustomerSegment: oppData.supporting_customer_segment,
            recommendedAction: oppData.recommended_action,
            audienceDefinition: {
              type: oppData.opportunity_type,
              segment: oppData.supporting_customer_segment
            },
            triggerReason: oppData.trigger_reason,
            aiSummary: oppData.ai_summary,
            aiReasoning: oppData.ai_reasoning,
            status: 'Detected'
          }
        });

        // Create audience mapping
        const audienceCustomers = await getAudienceCustomers(
          oppData.opportunity_type,
          oppData.supporting_customer_segment,
          audienceSize || oppData.audience_size
        );

        if (audienceCustomers.length > 0) {
          await prisma.opportunityCustomer.createMany({
            data: audienceCustomers.map(customerId => ({
              opportunityId: opportunity.id,
              customerId
            })),
            skipDuplicates: true
          });
        }

        createdOpportunities.push({
          id: opportunity.id,
          potentialRevenue: Number(opportunity.potentialRevenue),
          audienceSize: opportunity.audienceSize
        });

        console.log(`✅ Created opportunity: ${oppData.title} (${audienceSize} customers, ₹${oppData.potential_revenue})`);
      } catch (error) {
        console.error(`Error creating opportunity ${oppData.opportunity_key}:`, error);
      }
    }

    return createdOpportunities;
  } catch (error) {
    console.error('Error in AI analysis:', error);
    return [];
  }
}

/**
 * Get actual audience size based on segment criteria
 */
async function getAudienceSize(opportunityType: string, segment: string): Promise<number> {
  try {
    if (opportunityType === 'Retention' && segment.includes('churn')) {
      return await prisma.customerMetrics.count({
        where: {
          daysSinceLastOrder: { gte: 30 }
        }
      });
    }

    if (opportunityType === 'Retention' && segment.includes('VIP')) {
      return await prisma.customerMetrics.count({
        where: {
          totalSpent: { gte: 5000 },
          daysSinceLastOrder: { gte: 15 }
        }
      });
    }

    if (opportunityType === 'Upsell') {
      return await prisma.customerMetrics.count({
        where: {
          totalOrders: { gte: 3 },
          avgOrderValue: { lte: 2000 }
        }
      });
    }

    // Default: return all customers with orders
    return await prisma.customerMetrics.count({
      where: {
        totalOrders: { gte: 1 }
      }
    });
  } catch (error) {
    console.error('Error getting audience size:', error);
    return 0;
  }
}

/**
 * Get customer IDs for the audience segment
 */
async function getAudienceCustomers(
  opportunityType: string,
  segment: string,
  limit: number
): Promise<string[]> {
  try {
    let customers: Array<{ customerId: string }> = [];

    if (opportunityType === 'Retention' && segment.includes('churn')) {
      customers = await prisma.customerMetrics.findMany({
        where: {
          daysSinceLastOrder: { gte: 30 }
        },
        select: {
          customerId: true
        },
        take: limit
      });
    } else if (opportunityType === 'Retention' && segment.includes('VIP')) {
      customers = await prisma.customerMetrics.findMany({
        where: {
          totalSpent: { gte: 5000 },
          daysSinceLastOrder: { gte: 15 }
        },
        select: {
          customerId: true
        },
        take: limit
      });
    } else if (opportunityType === 'Upsell') {
      customers = await prisma.customerMetrics.findMany({
        where: {
          totalOrders: { gte: 3 },
          avgOrderValue: { lte: 2000 }
        },
        select: {
          customerId: true
        },
        take: limit
      });
    } else {
      // Default: get active customers
      customers = await prisma.customerMetrics.findMany({
        where: {
          totalOrders: { gte: 1 }
        },
        select: {
          customerId: true
        },
        take: limit
      });
    }

    return customers.map(c => c.customerId);
  } catch (error) {
    console.error('Error getting audience customers:', error);
    return [];
  }
}

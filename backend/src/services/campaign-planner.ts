import { prisma } from '../lib/prisma';
import OpenAI from 'openai';
import { openRouterConfig } from '../config/openrouter';
import { logger } from '../lib/logger';

const openai = new OpenAI({
  apiKey: openRouterConfig.apiKey,
  baseURL: openRouterConfig.baseUrl,
  defaultHeaders: {
    'HTTP-Referer': openRouterConfig.httpReferer,
    'X-Title': openRouterConfig.appName,
  },
});

/**
 * Create a campaign for a discovered opportunity
 * This generates the campaign strategy and messaging
 */
export async function createCampaignForOpportunity(
  opportunityId: string,
  companyId: string,
  agentId: string,
  guardrails: { channels?: string[] }
) {
  logger.info({ opportunityId }, 'Creating campaign');

  try {
    // Get opportunity details
    const opportunity = await prisma.opportunity.findUnique({
      where: { id: opportunityId },
      include: {
        audience: {
          take: 10,
          include: {
            customer: {
              include: {
                customerMetrics: true,
                customerAttributes: true
              }
            }
          }
        }
      }
    });

    if (!opportunity) {
      throw new Error(`Opportunity ${opportunityId} not found`);
    }

    // Use AI to generate campaign strategy
    const campaignStrategy = await generateCampaignStrategy(opportunity, guardrails);

    // Create campaign in database
    const campaign = await prisma.campaign.create({
      data: {
        companyId,
        agentId,
        opportunityId,
        name: campaignStrategy.name,
        objective: campaignStrategy.objective,
        channel: campaignStrategy.channel,
        offer: campaignStrategy.offer,
        messageAngle: campaignStrategy.messageAngle,
        messageContent: campaignStrategy.messageContent,
        messageVariants: campaignStrategy.messageVariants,
        expectedOutcome: campaignStrategy.expectedOutcome,
        reasoning: campaignStrategy.reasoning,
        status: 'Draft', // Start as draft
        performance: {
          sent: 0,
          delivered: 0,
          clicked: 0,
          converted: 0,
          revenue: 0
        }
      }
    });

    logger.info({ campaignName: campaign.name }, 'Campaign created');

    return campaign;
  } catch (error) {
    logger.error({ err: error }, 'Error creating campaign');
    throw error;
  }
}

/**
 * Generate campaign strategy using AI
 */
async function generateCampaignStrategy(opportunity: any, guardrails: { channels?: string[] }) {
  const allowedChannels = guardrails.channels || ['whatsapp', 'email', 'sms'];

  // Sample customer data for context
  const sampleCustomers = opportunity.audience.slice(0, 5).map((a: any) => ({
    totalSpent: a.customer.customerMetrics?.totalSpent || 0,
    avgOrderValue: a.customer.customerMetrics?.avgOrderValue || 0,
    totalOrders: a.customer.customerMetrics?.totalOrders || 0,
    daysSinceLastOrder: a.customer.customerMetrics?.daysSinceLastOrder || 0,
    favoriteCategory: a.customer.customerAttributes?.favoriteCategory
  }));

  const prompt = `You are an AI campaign strategist. Create a targeted marketing campaign for this opportunity.

OPPORTUNITY:
- Type: ${opportunity.opportunityType}
- Title: ${opportunity.title}
- Description: ${opportunity.description}
- Audience Size: ${opportunity.audienceSize} customers
- Segment: ${opportunity.supportingCustomerSegment}
- Recommended Action: ${opportunity.recommendedAction}

SAMPLE CUSTOMER PROFILES:
${JSON.stringify(sampleCustomers, null, 2)}

ALLOWED CHANNELS: ${allowedChannels.join(', ')}

Create a campaign strategy with:
1. name: Campaign name (catchy, action-oriented)
2. objective: Clear business objective
3. channel: Best channel from allowed list
4. offer: Specific offer/incentive (be creative but realistic)
5. messageAngle: Emotional/psychological angle
6. messageContent: Template message with {{name}} and {{offer}} placeholders
7. messageVariants: Array of 3 message variants (A, B, C) for personalization
8. expectedOutcome: What we expect to achieve
9. reasoning: Why this strategy will work

Respond ONLY with valid JSON. No markdown, no explanation.

Example format:
{
  "name": "VIP Win-Back Campaign",
  "objective": "Re-engage high-value customers who haven't purchased in 30+ days",
  "channel": "whatsapp",
  "offer": "Exclusive 20% off + free shipping on next order",
  "messageAngle": "We miss you - personalized exclusivity",
  "messageContent": "Hi {{name}}, we've noticed you haven't shopped with us in a while. As one of our VIP customers, we have something special for you: {{offer}}. Valid for 48 hours!",
  "messageVariants": [
    {"variant": "A", "message": "Hi {{name}}! We miss you 💙 As our VIP customer, here's an exclusive offer just for you: {{offer}}. Shop now before it expires!"},
    {"variant": "B", "message": "{{name}}, your VIP status comes with perks! Get {{offer}} on your next order. This offer won't last long - claim it now!"},
    {"variant": "C", "message": "Hey {{name}}, it's been a while! We've saved {{offer}} especially for you. Click to shop your favorites now 🛍️"}
  ],
  "expectedOutcome": "15-20% of targeted VIPs make a purchase within 7 days, generating ₹50K+ in revenue",
  "reasoning": "VIP customers have proven high lifetime value. Early intervention with personalized offers shows strong conversion rates. WhatsApp provides direct, immediate engagement."
}`;

  try {
    const response = await openai.chat.completions.create({
      model: openRouterConfig.defaultModel,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.8,
      max_tokens: 1500
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from AI');
    }

    const strategy = JSON.parse(content);
    return strategy;
  } catch (error) {
    logger.error({ err: error }, 'Error generating campaign strategy');

    // Fallback strategy
    return {
      name: `${opportunity.title} Campaign`,
      objective: opportunity.description,
      channel: allowedChannels[0] || 'email',
      offer: 'Special offer for you',
      messageAngle: 'Value proposition',
      messageContent: `Hi {{name}}, we have a special opportunity for you. ${opportunity.recommendedAction}`,
      messageVariants: [
        { variant: 'A', message: `Hi {{name}}, we have a special opportunity for you!` },
        { variant: 'B', message: `Hey {{name}}, don't miss this exclusive offer!` },
        { variant: 'C', message: `{{name}}, this is just for you!` }
      ],
      expectedOutcome: opportunity.aiSummary,
      reasoning: opportunity.aiReasoning || 'AI-generated campaign strategy'
    };
  }
}

/**
 * Generate personalized message for a specific customer
 */
export async function generatePersonalizedMessage(
  customerId: string,
  campaignId: string
): Promise<string> {
  try {
    // Get campaign details
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      include: {
        opportunity: true
      }
    });

    if (!campaign) {
      throw new Error(`Campaign ${campaignId} not found`);
    }

    // Get customer details
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      include: {
        customerMetrics: true,
        customerAttributes: true,
        orders: {
          orderBy: { orderDate: 'desc' },
          take: 5,
          include: {
            orderItems: {
              include: {
                product: true
              }
            }
          }
        }
      }
    });

    if (!customer) {
      throw new Error(`Customer ${customerId} not found`);
    }

    // Choose a message variant (simple rotation based on customer ID hash)
    const messageVariants = (campaign.messageVariants as any[]) || [];
    const variantIndex = customerId.charCodeAt(0) % messageVariants.length;
    const selectedVariant = messageVariants[variantIndex] || { message: campaign.messageContent };

    // Personalize the message
    let message = selectedVariant.message || campaign.messageContent;

    message = message.replace('{{name}}', customer.firstName);
    message = message.replace('{{offer}}', campaign.offer || 'special offer');

    // Add purchase history context if available
    if (customer.orders.length > 0) {
      const lastOrder = customer.orders[0];
      const daysSince = customer.customerMetrics?.daysSinceLastOrder || 0;

      if (daysSince > 30) {
        message = message.replace('{{context}}', `It's been ${daysSince} days since your last order`);
      }
    }

    return message;
  } catch (error) {
    logger.error({ err: error }, 'Error generating personalized message');
    return `Hi, we have a special offer for you!`;
  }
}

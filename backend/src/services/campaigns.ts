import { z } from 'zod';
import { openRouterConfig, openai } from '../config/openrouter';
import { logger } from '../lib/logger';
import { parseWithRetry } from '../lib/ai';
import { prisma } from '../lib/prisma';
import { launchPolicyReason } from './campaign-launch-policy';
import { getConfig } from '../lib/config';

export interface CampaignGenerationRequest {
  opportunityId: string;
  companyId?: string;
  model?: string;
}

export interface GeneratedCampaign {
  name: string;
  objective: string;
  channel: 'WhatsApp' | 'Email' | 'SMS';
  offer: string;
  message_angle: string;
  campaign_content: string;
  expected_outcome: string;
  reasoning: string;
}

const GeneratedCampaignSchema = z.object({
  name: z.string(),
  objective: z.string(),
  channel: z.enum(['WhatsApp', 'Email', 'SMS']),
  offer: z.string(),
  message_angle: z.string(),
  campaign_content: z.string().min(1),
  expected_outcome: z.string(),
  reasoning: z.string(),
});

const RefinedMessageSchema = z.object({
  message_content: z.string().min(1),
});

export interface CampaignRow {
  id: string;
  company_id: string;
  opportunity_id: string;
  name: string;
  objective: string;
  channel: string;
  offer: string | null;
  message_angle: string | null;
  message_content: string;
  expected_outcome: string | null;
  reasoning: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  approved_at: string | null;
  launched_at: string | null;
  completed_at: string | null;
}

export interface CampaignWithMetrics extends CampaignRow {
  audience_size: number;
  communications_sent: number;
  communications_delivered: number;
  communications_read: number;
  communications_clicked: number;
  communications_failed: number;
}

interface OpportunityRow {
  id: string;
  title: string;
  description: string;
  opportunity_type: string;
  audience_size: number;
  potential_revenue: number;
  confidence_score: number;
  recommended_action: string;
  supporting_customer_segment: string;
  trigger_reason: string;
  ai_summary: string;
}

interface CompanyRow {
  id: string;
  company_name: string;
  industry: string | null;
}

function toCampaignRow(row: {
  id: string;
  companyId: string;
  opportunityId: string;
  name: string;
  objective: string;
  channel: string;
  offer: string | null;
  messageAngle: string | null;
  messageContent: string;
  expectedOutcome: string | null;
  reasoning: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  approvedAt: Date | null;
  launchedAt: Date | null;
  completedAt: Date | null;
}): CampaignRow {
  return {
    id: row.id,
    company_id: row.companyId,
    opportunity_id: row.opportunityId,
    name: row.name,
    objective: row.objective,
    channel: row.channel,
    offer: row.offer,
    message_angle: row.messageAngle,
    message_content: row.messageContent,
    expected_outcome: row.expectedOutcome,
    reasoning: row.reasoning,
    status: row.status,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
    approved_at: row.approvedAt?.toISOString() ?? null,
    launched_at: row.launchedAt?.toISOString() ?? null,
    completed_at: row.completedAt?.toISOString() ?? null,
  };
}

function buildCampaignPrompt(opportunity: OpportunityRow, company: CompanyRow): string {
  return [
    'You are a retail marketing campaign strategist.',
    'Generate a campaign plan for a detected opportunity.',
    'Return ONLY valid JSON with these exact fields:',
    '- name: Campaign name (max 100 chars)',
    '- objective: Clear campaign objective',
    '- channel: One of "WhatsApp", "Email", or "SMS"',
    '- offer: The promotional offer or incentive',
    '- message_angle: The key messaging angle',
    '- campaign_content: The actual message content (personalized template)',
    '- expected_outcome: What we expect to achieve',
    '- reasoning: Why this campaign approach makes sense',
    '',
    `Company: ${company.company_name} (${company.industry ?? 'Retail'})`,
    `Opportunity Type: ${opportunity.opportunity_type}`,
    `Title: ${opportunity.title}`,
    `Description: ${opportunity.description}`,
    `Audience Size: ${opportunity.audience_size} customers`,
    `Potential Revenue: ₹${Math.round(opportunity.potential_revenue).toLocaleString('en-IN')}`,
    `Trigger Reason: ${opportunity.trigger_reason}`,
    `Recommended Action: ${opportunity.recommended_action}`,
    `Supporting Segment: ${opportunity.supporting_customer_segment}`,
    `AI Summary: ${opportunity.ai_summary}`,
    '',
    'Generate a campaign that:',
    '1. Addresses the opportunity type',
    '2. Uses appropriate channel (WhatsApp for urgent, Email for detailed, SMS for quick)',
    '3. Creates compelling offer',
    '4. Writes personalized message content with {{customer_name}} placeholder',
    '5. Sets realistic expected outcome',
    '',
    'Return only JSON, no markdown formatting.',
  ].join('\n');
}

/**
 * Load a company by id, failing closed. The previous fallback to the oldest row in
 * `companies` meant a missing id quietly resolved to some other tenant.
 */
async function ensureCompanyRow(companyId?: string): Promise<CompanyRow> {
  if (!companyId) {
    throw new Error('companyId is required');
  }

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { id: true, companyName: true, industry: true },
  });
  if (!company) throw new Error(`Company ${companyId} not found`);
  return { id: company.id, company_name: company.companyName, industry: company.industry };
}

async function fetchOpportunity(opportunityId: string): Promise<OpportunityRow> {
  const row = await prisma.opportunity.findUnique({ where: { id: opportunityId } });
  if (!row) throw new Error(`Opportunity ${opportunityId} not found`);
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    opportunity_type: row.opportunityType,
    audience_size: row.audienceSize,
    potential_revenue: Number(row.potentialRevenue),
    confidence_score: Number(row.confidenceScore),
    recommended_action: row.recommendedAction,
    supporting_customer_segment: row.supportingCustomerSegment,
    trigger_reason: row.triggerReason,
    ai_summary: row.aiSummary,
  };
}

export async function generateCampaign(
  request: CampaignGenerationRequest,
): Promise<{ campaign: GeneratedCampaign }> {
  const company = await ensureCompanyRow(request.companyId);
  const opportunity = await fetchOpportunity(request.opportunityId);

  const model = request.model ?? openRouterConfig.defaultModel;
  
  try {
    const campaign = await parseWithRetry(
      () => openai.chat.completions.create({
        model,
        temperature: 0.7,
        max_tokens: 800,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: 'You output only valid JSON and never include markdown formatting.' },
          { role: 'user', content: buildCampaignPrompt(opportunity, company) },
        ],
      }).then(r => r.choices[0]?.message?.content ?? ''),
      GeneratedCampaignSchema,
    );
    return { campaign };
  } catch (err: any) {
    logger.warn({ err: err?.message ?? err }, 'Campaign: AI unavailable, using deterministic fallback');
    return { campaign: buildFallbackCampaign(opportunity, company) };
  }
}

function buildFallbackCampaign(opportunity: OpportunityRow, company: CompanyRow): GeneratedCampaign {
  const typeChannelMap: Record<string, 'WhatsApp' | 'Email' | 'SMS'> = {
    'Win-Back': 'Email',
    'Upsell': 'WhatsApp',
    'Cross-Sell': 'Email',
    'Re-engagement': 'Email',
    'Loyalty': 'WhatsApp',
    'Seasonal': 'SMS',
    'VIP': 'WhatsApp',
    'Abandoned Cart': 'Email',
  };
  const channel = typeChannelMap[opportunity.opportunity_type] ?? 'Email';
  const rev = opportunity.potential_revenue
    ? `₹${opportunity.potential_revenue >= 100000 ? (opportunity.potential_revenue / 100000).toFixed(1) + 'L' : Math.round(opportunity.potential_revenue / 1000) + 'K'}`
    : 'significant revenue';

  const templates: Record<string, Partial<GeneratedCampaign>> = {
    'Win-Back': {
      name: `${company.company_name} Win-Back Campaign`,
      objective: `Re-activate ${opportunity.audience_size} lapsed customers and recover ${rev} in potential revenue`,
      offer: '20% exclusive comeback discount',
      message_angle: 'We miss you — here\'s a personal offer to welcome you back',
      campaign_content: `Hi {{customer_name}},\n\nWe noticed it's been a while since your last order at ${company.company_name} — and we genuinely miss you.\n\nAs a valued customer, we're offering you an exclusive 20% discount on your next purchase. This offer is just for you and expires in 72 hours.\n\n👉 Shop now and save 20%\n\nWarm regards,\nThe ${company.company_name} Team`,
      expected_outcome: `${Math.round(opportunity.audience_size * 0.15)} customers re-activated, ${rev} revenue recovered`,
    },
    'Upsell': {
      name: `${company.company_name} Premium Upsell`,
      objective: `Upgrade ${opportunity.audience_size} customers to premium products and grow basket size`,
      offer: 'Free upgrade + priority delivery',
      message_angle: 'Based on your taste, you\'ll love what\'s next',
      campaign_content: `Hi {{customer_name}},\n\nYou have great taste — and we think you're ready for something even better.\n\nBased on your purchase history at ${company.company_name}, we've handpicked premium options we know you'll love. Order in the next 48 hours and get free priority delivery.\n\n👉 Explore your personalised picks\n\nBest,\nThe ${company.company_name} Team`,
      expected_outcome: `${Math.round(opportunity.audience_size * 0.22)} upgrades, average order value increase of 35%`,
    },
    'Re-engagement': {
      name: `VIP Re-engagement: Exclusive Early Access & Thank You Discount`,
      objective: `Re-engage ${opportunity.audience_size} inactive VIP customers and prevent churn`,
      offer: '15% thank-you discount + early access',
      message_angle: 'You\'re one of our most valued customers — here\'s your exclusive reward',
      campaign_content: `Hi {{customer_name}},\n\nAs one of our most valued customers at ${company.company_name}, you deserve something special.\n\nWe're giving you exclusive early access to our latest collection — 24 hours before anyone else — plus a 15% thank-you discount on anything you love.\n\n👉 Access your exclusive preview now\n\nWith appreciation,\nThe ${company.company_name} Team`,
      expected_outcome: `${Math.round(opportunity.audience_size * 0.18)} customers re-engaged, ${rev} revenue generated`,
    },
  };

  const t = templates[opportunity.opportunity_type] ?? templates['Re-engagement'];
  return {
    name: t.name ?? `${company.company_name} — ${opportunity.opportunity_type} Campaign`,
    objective: t.objective ?? opportunity.recommended_action ?? `Drive engagement for ${opportunity.audience_size} customers`,
    channel,
    offer: t.offer ?? '15% exclusive discount',
    message_angle: t.message_angle ?? 'Personalised offer based on your purchase history',
    campaign_content: t.campaign_content ?? `Hi {{customer_name}},\n\nWe have a special offer just for you at ${company.company_name}. Take advantage of this limited-time opportunity today.\n\nBest,\nThe ${company.company_name} Team`,
    expected_outcome: t.expected_outcome ?? `${Math.round(opportunity.audience_size * 0.15)} conversions expected`,
    reasoning: `Campaign generated for ${opportunity.opportunity_type} opportunity targeting ${opportunity.audience_size} customers with ${opportunity.confidence_score}% confidence. ${opportunity.trigger_reason ?? ''}`,
  };
}

export async function saveCampaign(
  opportunityId: string,
  campaign: GeneratedCampaign,
  companyId?: string,
): Promise<CampaignRow> {
  const company = await ensureCompanyRow(companyId);
  const existing = await prisma.campaign.findFirst({
    where: { opportunityId, companyId: company.id },
    orderBy: { createdAt: 'asc' },
  });
  if (existing) return toCampaignRow(existing);

  try {
    const created = await prisma.campaign.create({
      data: {
        companyId: company.id,
        opportunityId,
        name: campaign.name,
        objective: campaign.objective,
        channel: campaign.channel,
        offer: campaign.offer,
        messageAngle: campaign.message_angle,
        messageContent: campaign.campaign_content,
        expectedOutcome: campaign.expected_outcome,
        reasoning: campaign.reasoning,
        status: 'Draft',
      },
    });
    await prisma.campaignAuditEvent.create({
      data: { companyId: company.id, campaignId: created.id, eventType: 'PROPOSED' },
    });
    return toCampaignRow(created);
  } catch (error) {
    if ((error as { code?: string }).code !== 'P2002') throw error;
    const winner = await prisma.campaign.findFirstOrThrow({
      where: { opportunityId, companyId: company.id },
      orderBy: { createdAt: 'asc' },
    });
    return toCampaignRow(winner);
  }
}

export async function launchCampaign(
  campaignId: string,
): Promise<{ campaign: CampaignRow; communications_created: number }> {
  const result = await prisma.$transaction(async (tx) => {
    const campaign = await tx.campaign.findUnique({
      where: { id: campaignId },
      include: {
        company: { select: { timezone: true } },
        agent: { select: { guardrails: true } },
        opportunity: {
          select: {
            audienceSize: true,
            audience: {
              select: {
                customerId: true,
                customer: {
                  select: {
                    email: true,
                    phone: true,
                    emailMarketingConsent: true,
                    smsMarketingConsent: true,
                  },
                },
              },
            },
          },
        },
      },
    });
    if (!campaign) throw new Error(`Campaign ${campaignId} not found`);

    const existing = await tx.communication.findMany({ where: { campaignId } });
    if (campaign.status === 'Dispatching' || campaign.status === 'Launched') {
      return { campaign, communications: existing };
    }
    if (campaign.status !== 'Approved') {
      throw new Error(`Campaign must be approved before launch (current status: ${campaign.status})`);
    }
    if (campaign.approvedAt && Date.now() - campaign.approvedAt.getTime() > 24 * 60 * 60 * 1000) {
      await tx.campaign.update({ where: { id: campaignId }, data: { status: 'Draft', approvedAt: null } });
      await tx.campaignAuditEvent.create({
        data: { companyId: campaign.companyId, campaignId, eventType: 'EXPIRED', metadata: { approvalTtlHours: 24 } },
      });
      throw new Error('Campaign approval expired; review and approve it again');
    }

    const audience = campaign.opportunity.audience.slice(0, campaign.opportunity.audienceSize);
    const quietHours = await getConfig(campaign.companyId, 'campaign.quiet_hours');
    const policyReason = launchPolicyReason({
      channel: campaign.channel,
      timezone: campaign.company.timezone,
      customers: audience.map(({ customer }) => customer),
      allowedChannels: (campaign.agent?.guardrails as { channels?: unknown } | null)?.channels,
      quietHours,
    });
    if (policyReason) {
      await tx.campaignAuditEvent.create({
        data: { companyId: campaign.companyId, campaignId, eventType: 'POLICY_DENIED', metadata: { reason: policyReason } },
      });
      return { campaign, communications: existing, policyReason };
    }

    const claimed = await tx.campaign.updateMany({
      where: { id: campaignId, companyId: campaign.companyId, status: 'Approved' },
      data: { status: 'Dispatching' },
    });
    if (claimed.count === 0) {
      return {
        campaign: await tx.campaign.findUniqueOrThrow({ where: { id: campaignId } }),
        communications: await tx.communication.findMany({ where: { campaignId } }),
      };
    }
    await tx.communication.createMany({
      data: audience.map(({ customerId }) => ({
        campaignId,
        customerId,
        channel: campaign.channel,
        message: campaign.messageContent,
        status: 'QUEUED',
        idempotencyKey: `${campaignId}:${customerId}`,
      })),
      skipDuplicates: true,
    });
    const communications = await tx.communication.findMany({ where: { campaignId } });
    await tx.communicationEvent.createMany({
      data: communications.map((communication) => ({
        communicationId: communication.id,
        eventType: 'QUEUED',
        sequenceNumber: 1,
      })),
      skipDuplicates: true,
    });
    await tx.campaignAuditEvent.create({
      data: {
        companyId: campaign.companyId,
        campaignId,
        eventType: 'LAUNCH_CLAIMED',
        metadata: { recipients: communications.length, channel: campaign.channel },
      },
    });
    return {
      campaign: await tx.campaign.findUniqueOrThrow({ where: { id: campaignId } }),
      communications,
    };
  });

  if ('policyReason' in result) throw new Error(result.policyReason);

  const { enqueueCommunicationDispatchBatch } = await import('../lib/queues');
  await enqueueCommunicationDispatchBatch(result.communications.map((communication) => ({
    companyId: result.campaign.companyId,
    communicationId: communication.id,
  })));
  return {
    campaign: toCampaignRow(result.campaign),
    communications_created: result.communications.length,
  };
}

export async function getCampaigns(
  companyId?: string,
  opts: { page?: number; limit?: number } = {},
): Promise<{ data: CampaignWithMetrics[]; total: number }> {
  const company = await ensureCompanyRow(companyId);
  const limit = opts.limit ?? 20;
  const page = opts.page ?? 1;
  const [campaigns, total] = await Promise.all([
    prisma.campaign.findMany({
      where: { companyId: company.id },
      include: { opportunity: { select: { audienceSize: true } } },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.campaign.count({ where: { companyId: company.id } }),
  ]);
  const campaignIds = campaigns.map((campaign) => campaign.id);
  const communications = await prisma.communication.findMany({
    where: { campaignId: { in: campaignIds } },
    include: { events: { select: { eventType: true } } },
  });

  const countsByCampaign = new Map<string, Record<string, number>>();
  for (const communication of communications) {
    let counts = countsByCampaign.get(communication.campaignId);
    if (!counts) {
      counts = {};
      countsByCampaign.set(communication.campaignId, counts);
    }
    for (const event of communication.events) {
      counts[event.eventType] = (counts[event.eventType] ?? 0) + 1;
    }
  }

  const campaignsWithMetrics = campaigns.map((campaign) => {
    const counts = countsByCampaign.get(campaign.id) ?? {};
    return {
      ...toCampaignRow(campaign),
      audience_size: campaign.opportunity.audienceSize,
      communications_sent: counts.SENT ?? 0,
      communications_delivered: counts.DELIVERED ?? 0,
      communications_read: counts.READ ?? 0,
      communications_clicked: counts.CLICKED ?? 0,
      communications_failed: counts.FAILED ?? 0,
    };
  });

  return { data: campaignsWithMetrics, total };
}

export async function refineCampaignMessage(
  campaignId: string,
  modifier: string,
  newChannel?: string,
  options: { model?: string } = {},
): Promise<{ message_content: string; channel: string }> {
  const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
  if (!campaign) throw new Error(`Campaign ${campaignId} not found`);
  if (campaign.status !== 'Draft') throw new Error('Only draft campaigns can be edited');

  const targetChannel = newChannel ?? campaign.channel;
  const isChannelSwitch = newChannel && newChannel !== campaign.channel;

  const channelConstraints: Record<string, string> = {
    WhatsApp: 'Up to 1000 characters. Conversational tone. Can use emojis and line breaks.',
    Email: 'Can be long. Professional tone. Include a warm greeting and clear call-to-action.',
    SMS: 'STRICTLY under 160 characters total. No line breaks. Concise and direct. One CTA only.',
  };

  const prompt = [
    'You are a campaign copywriter for a retail brand.',
    `Rewrite the campaign message below for the ${targetChannel} channel.`,
    `Channel constraints: ${channelConstraints[targetChannel] ?? 'Standard marketing message.'}`,
    isChannelSwitch ? `The message is being adapted from ${campaign.channel} to ${targetChannel}. Adjust format, length, and tone accordingly.` : '',
    `Offer: ${campaign.offer ?? 'N/A'}`,
    `Objective: ${campaign.objective ?? 'Re-engage customers'}`,
    '',
    'Current message:',
    campaign.messageContent,
    '',
    `Marketer instruction: "${modifier.trim() || (isChannelSwitch ? `Adapt this message for ${targetChannel}` : 'Improve the copy')}"`,
    '',
    'Return JSON only with this exact key: { "message_content": "..." }',
    'No markdown fences.',
  ].filter(Boolean).join('\n');

  const model = options.model ?? openRouterConfig.defaultModel;
  
  const parsed = await parseWithRetry(
    () => openai.chat.completions.create({
      model,
      temperature: 0.4,
      max_tokens: 400,
      messages: [
        { role: 'system', content: 'Output only valid JSON. No markdown.' },
        { role: 'user', content: prompt },
      ],
    }).then(r => r.choices[0]?.message?.content ?? ''),
    RefinedMessageSchema,
  );

  await prisma.campaign.update({
    where: { id: campaignId },
    data: {
      messageContent: parsed.message_content,
      ...(isChannelSwitch ? { channel: targetChannel } : {}),
    },
  });

  return { message_content: parsed.message_content, channel: targetChannel };
}

export async function getCampaignById(
  campaignId: string,
): Promise<CampaignWithMetrics> {
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    include: {
      opportunity: { select: { audienceSize: true } },
      communications: { include: { events: { select: { eventType: true } } } },
    },
  });
  if (!campaign) throw new Error(`Campaign ${campaignId} not found`);
  const eventCounts: Record<string, number> = {};
  for (const communication of campaign.communications) {
    for (const event of communication.events) {
      eventCounts[event.eventType] = (eventCounts[event.eventType] ?? 0) + 1;
    }
  }

  return {
    ...toCampaignRow(campaign),
    audience_size: campaign.opportunity.audienceSize,
    communications_sent: eventCounts.SENT ?? 0,
    communications_delivered: eventCounts.DELIVERED ?? 0,
    communications_read: eventCounts.READ ?? 0,
    communications_clicked: eventCounts.CLICKED ?? 0,
    communications_failed: eventCounts.FAILED ?? 0,
  };
}

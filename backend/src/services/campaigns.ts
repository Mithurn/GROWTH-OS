import OpenAI from 'openai';
import type { SupabaseClient } from '@supabase/supabase-js';
import { openRouterConfig } from '../config/openrouter';

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

async function ensureCompanyRow(supabase: SupabaseClient, companyId?: string): Promise<CompanyRow> {
  if (companyId) {
    const { data, error } = await supabase
      .from('companies')
      .select('id, company_name, industry')
      .eq('id', companyId)
      .maybeSingle();

    if (error) throw new Error(`Failed to load company ${companyId}: ${error.message}`);
    if (data) return data as CompanyRow;
  }

  const { data: existing, error: existingError } = await supabase
    .from('companies')
    .select('id, company_name, industry')
    .order('created_at', { ascending: true })
    .limit(1);

  if (existingError) {
    throw new Error(`Failed to inspect companies table: ${existingError.message}`);
  }

  if (existing && existing.length > 0) {
    return existing[0] as CompanyRow;
  }

  throw new Error('No company found');
}

async function fetchOpportunity(supabase: SupabaseClient, opportunityId: string): Promise<OpportunityRow> {
  const { data, error } = await supabase
    .from('opportunities')
    .select('id, title, description, opportunity_type, audience_size, potential_revenue, confidence_score, recommended_action, supporting_customer_segment, trigger_reason, ai_summary')
    .eq('id', opportunityId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load opportunity: ${error.message}`);
  }

  if (!data) {
    throw new Error(`Opportunity ${opportunityId} not found`);
  }

  return data as OpportunityRow;
}

export async function generateCampaign(
  supabase: SupabaseClient,
  request: CampaignGenerationRequest,
): Promise<{ campaign: GeneratedCampaign }> {
  const company = await ensureCompanyRow(supabase, request.companyId);
  const opportunity = await fetchOpportunity(supabase, request.opportunityId);

  const model = request.model ?? openRouterConfig.defaultModel;
  const client = new OpenAI({
    apiKey: openRouterConfig.apiKey,
    baseURL: openRouterConfig.baseUrl,
    defaultHeaders: {
      'HTTP-Referer': openRouterConfig.httpReferer,
      'X-Title': openRouterConfig.appName,
    },
  });

  const response = await client.chat.completions.create({
    model,
    temperature: 0.7,
    max_tokens: 800,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: 'You output only valid JSON and never include markdown formatting.',
      },
      {
        role: 'user',
        content: buildCampaignPrompt(opportunity, company),
      },
    ],
  });

  const raw = response.choices[0]?.message?.content ?? '';

  try {
    // Strip markdown code fences if present
    let jsonString = raw.trim();
    if (jsonString.startsWith('```')) {
      jsonString = jsonString.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
    }

    const parsed = JSON.parse(jsonString) as GeneratedCampaign;

    // Validate required fields
    if (!parsed.name || !parsed.objective || !parsed.channel || !parsed.campaign_content) {
      throw new Error('Missing required campaign fields');
    }

    // Validate channel
    if (!['WhatsApp', 'Email', 'SMS'].includes(parsed.channel)) {
      throw new Error(`Invalid channel: ${parsed.channel}`);
    }

    return { campaign: parsed };
  } catch (err) {
    throw new Error(`Campaign generation returned invalid JSON: ${err}`);
  }
}

export async function saveCampaign(
  supabase: SupabaseClient,
  opportunityId: string,
  campaign: GeneratedCampaign,
  companyId?: string,
): Promise<CampaignRow> {
  const company = await ensureCompanyRow(supabase, companyId);

  // Check for existing campaign with same opportunity
  const { data: existing, error: checkError } = await supabase
    .from('campaigns')
    .select('id, name, status')
    .eq('opportunity_id', opportunityId)
    .eq('company_id', company.id)
    .maybeSingle();

  if (checkError) {
    throw new Error(`Failed to check for existing campaigns: ${checkError.message}`);
  }

  if (existing) {
    throw new Error(`A campaign already exists for this opportunity: "${existing.name}" (${existing.status}). Please use the existing campaign or delete it first.`);
  }

  const { data, error } = await supabase
    .from('campaigns')
    .insert({
      company_id: company.id,
      opportunity_id: opportunityId,
      name: campaign.name,
      objective: campaign.objective,
      channel: campaign.channel,
      offer: campaign.offer,
      message_angle: campaign.message_angle,
      message_content: campaign.campaign_content,
      expected_outcome: campaign.expected_outcome,
      reasoning: campaign.reasoning,
      status: 'Draft',
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to save campaign: ${error.message}`);
  }

  return data as CampaignRow;
}

export async function approveCampaign(
  supabase: SupabaseClient,
  campaignId: string,
): Promise<CampaignRow> {
  const { data, error } = await supabase
    .from('campaigns')
    .update({
      status: 'Approved',
      approved_at: new Date().toISOString(),
    })
    .eq('id', campaignId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to approve campaign: ${error.message}`);
  }

  return data as CampaignRow;
}

export async function launchCampaign(
  supabase: SupabaseClient,
  campaignId: string,
): Promise<{ campaign: CampaignRow; communications_created: number }> {
  // Get campaign details
  const { data: campaign, error: campaignError } = await supabase
    .from('campaigns')
    .select('id, company_id, opportunity_id, channel, message_content, status')
    .eq('id', campaignId)
    .single();

  if (campaignError) {
    throw new Error(`Failed to load campaign: ${campaignError.message}`);
  }

  if (campaign.status !== 'Approved') {
    throw new Error(`Campaign must be approved before launch (current status: ${campaign.status})`);
  }

  // Get audience from opportunity
  const { data: audienceRows, error: audienceError } = await supabase
    .from('opportunity_customers')
    .select('customer_id')
    .eq('opportunity_id', campaign.opportunity_id);

  if (audienceError) {
    throw new Error(`Failed to load campaign audience: ${audienceError.message}`);
  }

  if (!audienceRows || audienceRows.length === 0) {
    throw new Error('No customers found in opportunity audience');
  }

  // Create communications in QUEUED state
  const communications = audienceRows.map((row: any) => ({
    campaign_id: campaignId,
    customer_id: row.customer_id,
    channel: campaign.channel,
    message: campaign.message_content,
    status: 'QUEUED',
  }));

  const { error: commsError } = await supabase
    .from('communications')
    .insert(communications);

  if (commsError) {
    throw new Error(`Failed to create communications: ${commsError.message}`);
  }

  // Fetch created communications with customer details
  const { data: createdComms, error: fetchCommsError } = await supabase
    .from('communications')
    .select('id, customer_id, channel, message, customers(email, phone)')
    .eq('campaign_id', campaignId);

  if (fetchCommsError) {
    throw new Error(`Failed to fetch created communications: ${fetchCommsError.message}`);
  }

  // Send each communication to the Channel Service
  const CHANNEL_SERVICE_URL = process.env.CHANNEL_SERVICE_URL || 'http://localhost:5001';

  for (const comm of createdComms) {
    try {
      const customer = (comm as any).customers;
      const recipient = campaign.channel === 'Email' ? customer?.email : customer?.phone;

      if (!recipient) {
        console.warn(`[Launch] Skipping communication ${comm.id}: No ${campaign.channel === 'Email' ? 'email' : 'phone'} for customer ${comm.customer_id}`);
        continue;
      }

      const response = await fetch(`${CHANNEL_SERVICE_URL}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          communicationId: comm.id,
          recipient,
          channel: campaign.channel,
          content: comm.message,
        }),
      });

      if (!response.ok) {
        throw new Error(`Channel Service responded with ${response.status}`);
      }

      const result = await response.json();

      // Update communication with provider message ID
      await supabase
        .from('communications')
        .update({ provider_message_id: result.providerMessageId })
        .eq('id', comm.id);

      console.log(`[Launch] ✓ Sent ${comm.id} to Channel Service: ${result.providerMessageId}`);
    } catch (error) {
      console.error(`[Launch] Failed to send communication ${comm.id}:`, error);

      // Mark as failed
      await supabase
        .from('communications')
        .update({
          status: 'FAILED',
          failure_reason: `Channel Service error: ${error}`,
          failed_at: new Date().toISOString(),
        })
        .eq('id', comm.id);
    }
  }

  // Create QUEUED events for all communications
  const events = createdComms.map((comm: any) => ({
    communication_id: comm.id,
    event_type: 'QUEUED',
    event_timestamp: new Date().toISOString(),
    sequence_number: 1,
  }));

  const { error: eventsError } = await supabase
    .from('communication_events')
    .insert(events);

  if (eventsError) {
    throw new Error(`Failed to create communication events: ${eventsError.message}`);
  }

  // Update campaign status to Launched
  const { data: updatedCampaign, error: updateError } = await supabase
    .from('campaigns')
    .update({
      status: 'Launched',
      launched_at: new Date().toISOString(),
    })
    .eq('id', campaignId)
    .select()
    .single();

  if (updateError) {
    throw new Error(`Failed to update campaign status: ${updateError.message}`);
  }

  return {
    campaign: updatedCampaign as CampaignRow,
    communications_created: communications.length,
  };
}

export async function getCampaigns(
  supabase: SupabaseClient,
  companyId?: string,
): Promise<CampaignWithMetrics[]> {
  const company = await ensureCompanyRow(supabase, companyId);

  const { data: campaigns, error } = await supabase
    .from('campaigns')
    .select(`
      *,
      opportunities(audience_size)
    `)
    .eq('company_id', company.id)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to load campaigns: ${error.message}`);
  }

  // Get communication counts for each campaign
  const campaignsWithMetrics = await Promise.all(
    (campaigns ?? []).map(async (campaign: any) => {
      const { data: events } = await supabase
        .from('communication_events')
        .select('event_type, communication_id')
        .in('communication_id',
          await supabase
            .from('communications')
            .select('id')
            .eq('campaign_id', campaign.id)
            .then(res => res.data?.map((c: any) => c.id) ?? [])
        );

      const eventCounts = (events ?? []).reduce((acc: any, event: any) => {
        acc[event.event_type] = (acc[event.event_type] || 0) + 1;
        return acc;
      }, {});

      return {
        ...campaign,
        audience_size: campaign.opportunities?.audience_size ?? 0,
        communications_sent: eventCounts.SENT ?? 0,
        communications_delivered: eventCounts.DELIVERED ?? 0,
        communications_read: eventCounts.READ ?? 0,
        communications_clicked: eventCounts.CLICKED ?? 0,
        communications_failed: eventCounts.FAILED ?? 0,
      };
    })
  );

  return campaignsWithMetrics as CampaignWithMetrics[];
}

export async function getCampaignById(
  supabase: SupabaseClient,
  campaignId: string,
): Promise<CampaignWithMetrics> {
  const { data: campaign, error } = await supabase
    .from('campaigns')
    .select(`
      *,
      opportunities(audience_size, title, description)
    `)
    .eq('id', campaignId)
    .single();

  if (error) {
    throw new Error(`Failed to load campaign: ${error.message}`);
  }

  // Get communication events
  const { data: communications } = await supabase
    .from('communications')
    .select('id')
    .eq('campaign_id', campaignId);

  const commIds = (communications ?? []).map((c: any) => c.id);

  const { data: events } = await supabase
    .from('communication_events')
    .select('event_type')
    .in('communication_id', commIds);

  const eventCounts = (events ?? []).reduce((acc: any, event: any) => {
    acc[event.event_type] = (acc[event.event_type] || 0) + 1;
    return acc;
  }, {});

  return {
    ...campaign,
    audience_size: campaign.opportunities?.audience_size ?? 0,
    communications_sent: eventCounts.SENT ?? 0,
    communications_delivered: eventCounts.DELIVERED ?? 0,
    communications_read: eventCounts.READ ?? 0,
    communications_clicked: eventCounts.CLICKED ?? 0,
    communications_failed: eventCounts.FAILED ?? 0,
  } as CampaignWithMetrics;
}

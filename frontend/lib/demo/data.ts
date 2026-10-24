import type { CampaignWithMetrics, GeneratedCampaign, Opportunity } from '../types';

/**
 * Sample data for demo mode. Shapes mirror the real API responses (see lib/types.ts and
 * the backend routes) so the unmodified pages render it. Figures are internally
 * consistent: audience sizes, revenue and funnel counts all add up.
 */

const DAY = 86_400_000;
const ago = (ms: number) => new Date(Date.now() - ms).toISOString();

export const DEMO_COMPANY_ID = 'demo-company';

export const DEMO_COMPANY = {
  company_name: 'Thread & Needle',
  industry: 'Fashion & Apparel',
  onboarding_profile: {
    strategy: {
      priority: ['Win back lapsed customers'],
      audience: ['VIP customers', 'At-risk customers'],
      engagement: ['Personalised offers'],
      channels: ['WhatsApp', 'Email'],
      involvement: ['I approve every campaign'],
    },
    guardrails: { budget: '25000' },
  },
};

type OppSeed = Pick<
  Opportunity,
  | 'opportunity_id' | 'opportunity_type' | 'title' | 'description' | 'audience_size' | 'potential_revenue'
  | 'confidence_score' | 'priority_score' | 'supporting_customer_segment' | 'recommended_action'
  | 'audience_definition' | 'trigger_reason' | 'ai_summary' | 'predicted_conversion_rate'
  | 'alternative_strategies' | 'opportunity_personas' | 'average_spend' | 'average_orders' | 'status'
>;

const seeds: OppSeed[] = [
  {
    opportunity_id: 'opp-dormant-vips',
    opportunity_type: 'Dormant VIPs',
    title: 'Win back 76 dormant VIPs',
    description: 'High-spending customers who have not ordered in over 90 days.',
    audience_size: 76,
    potential_revenue: 112000,
    confidence_score: 88,
    priority_score: 92,
    supporting_customer_segment: 'VIP',
    recommended_action: 'Send a WhatsApp message with an early-access offer',
    audience_definition: { segment: 'VIP', days_since_last_order: '>= 90' },
    trigger_reason: 'These customers averaged 6 orders each before going quiet. Their last purchase was over 90 days ago.',
    ai_summary:
      '76 of your best customers have gone quiet. They spent ₹4,820 on average per order and bought roughly every five weeks until the gap opened. A personal early-access offer on the new season is the most likely way to bring them back.',
    predicted_conversion_rate: 14,
    alternative_strategies: [
      { title: 'Email with a loyalty reward', conversion_rate: 9, note: 'Cheaper, slower to convert' },
      { title: 'SMS reminder with a 10% code', conversion_rate: 7, note: 'Short reach, lower intent' },
    ],
    opportunity_personas: [
      { name: 'Loyal Trendsetters', description: 'Buy new arrivals within a week of launch' },
      { name: 'Seasonal Splurgers', description: 'Large baskets around festivals' },
    ],
    average_spend: 4820,
    average_orders: 6,
    status: 'Discovered',
  },
  {
    opportunity_id: 'opp-churn-risk',
    opportunity_type: 'Churn risk',
    title: 'Retain 143 customers drifting away',
    description: 'Repeat buyers whose purchase gap is widening.',
    audience_size: 143,
    potential_revenue: 96500,
    confidence_score: 81,
    priority_score: 78,
    supporting_customer_segment: 'Loyal',
    recommended_action: 'Send an Email with a personalised pick of their favourite category',
    audience_definition: { segment: 'Loyal', days_since_last_order: '>= 60' },
    trigger_reason: 'Their gap between orders has grown from 34 days to 71 days over the last quarter.',
    ai_summary:
      '143 repeat customers are ordering far less often than they used to. Reaching them before the gap becomes permanent is cheaper than winning them back later.',
    predicted_conversion_rate: 11,
    alternative_strategies: [{ title: 'WhatsApp nudge', conversion_rate: 13, note: 'Higher open rate' }],
    opportunity_personas: [{ name: 'Steady Regulars', description: 'Reliable monthly buyers' }],
    average_spend: 2940,
    average_orders: 4,
    status: 'Campaign Created',
  },
  {
    opportunity_id: 'opp-cross-sell-denim',
    opportunity_type: 'Cross-sell',
    title: 'Cross-sell denim to 212 jacket buyers',
    description: 'Customers who bought jackets but never denim.',
    audience_size: 212,
    potential_revenue: 74800,
    confidence_score: 74,
    priority_score: 64,
    supporting_customer_segment: 'Active',
    recommended_action: 'Send a WhatsApp bundle offer pairing denim with their jacket',
    audience_definition: { favorite_category: 'Jackets', has_bought: 'Denim = false' },
    trigger_reason: 'Jacket buyers who also bought denim spend 2.1x more over the following year.',
    ai_summary: 'Jacket buyers are your strongest cross-sell audience for denim, with a bundle that lifts basket size.',
    predicted_conversion_rate: 8,
    alternative_strategies: [{ title: 'Email lookbook', conversion_rate: 6, note: 'Visual, longer to act on' }],
    opportunity_personas: [{ name: 'Style Builders', description: 'Complete outfits rather than single items' }],
    average_spend: 3350,
    average_orders: 3,
    status: 'Discovered',
  },
  {
    opportunity_id: 'opp-new-reactivation',
    opportunity_type: 'Reactivation',
    title: 'Reactivate 318 one-time buyers',
    description: 'Customers who bought once, more than 120 days ago.',
    audience_size: 318,
    potential_revenue: 58200,
    confidence_score: 67,
    priority_score: 52,
    supporting_customer_segment: 'New',
    recommended_action: 'Send an SMS with a limited-time second-order discount',
    audience_definition: { total_orders: 1, days_since_last_order: '>= 120' },
    trigger_reason: 'A second purchase within 120 days predicts a repeat customer. These customers missed that window.',
    ai_summary: 'Most one-time buyers never return unprompted. A second-order offer is the lowest-cost lever you have.',
    predicted_conversion_rate: 6,
    alternative_strategies: [],
    opportunity_personas: [{ name: 'Curious Browsers', description: 'Tried you once, price sensitive' }],
    average_spend: 1840,
    average_orders: 1,
    status: 'Discovered',
  },
  {
    opportunity_id: 'opp-festive-launch',
    opportunity_type: 'Seasonal',
    title: 'Festive preview for 189 high-basket buyers',
    description: 'Customers whose largest baskets landed in the last festive season.',
    audience_size: 189,
    potential_revenue: 141000,
    confidence_score: 79,
    priority_score: 71,
    supporting_customer_segment: 'Festive',
    recommended_action: 'Send a WhatsApp preview of the festive collection',
    audience_definition: { festive_spend_share: '>= 40%' },
    trigger_reason: 'Last festive season, this group spent 3.4x their normal monthly average in two weeks.',
    ai_summary: 'A early festive preview captures the biggest seasonal spenders before competitors reach them.',
    predicted_conversion_rate: 16,
    alternative_strategies: [{ title: 'Email countdown series', conversion_rate: 10, note: 'More touches, slower' }],
    opportunity_personas: [{ name: 'Seasonal Splurgers', description: 'Large baskets around festivals' }],
    average_spend: 5260,
    average_orders: 3,
    status: 'Campaign Launched',
  },
];

export const DEMO_TOTAL_CUSTOMERS = 1480;

export function hydrateOpportunity(seed: OppSeed): Opportunity {
  return {
    ...seed,
    opportunity_key: seed.opportunity_id,
    customer_count: seed.audience_size,
    revenue_share: 0,
  };
}

export function buildOpportunities(extra: Opportunity[] = []): Opportunity[] {
  const list = [...extra, ...seeds.map(hydrateOpportunity)];
  const total = list.reduce((sum, o) => sum + o.potential_revenue, 0);
  return list.map((o) => ({ ...o, revenue_share: Math.round((o.potential_revenue / total) * 100) }));
}

const FIRST = ['Aarav', 'Ishita', 'Rohan', 'Meera', 'Kabir', 'Ananya', 'Vihaan', 'Diya', 'Arjun', 'Saanvi', 'Reyansh', 'Kiara'];
const LAST = ['Sharma', 'Iyer', 'Mehta', 'Nair', 'Kapoor', 'Reddy', 'Bose', 'Menon', 'Gupta', 'Das'];
const CATEGORIES = ['Jackets', 'Denim', 'Dresses', 'Knitwear', 'Footwear', 'Accessories'];
const CHANNELS = ['WhatsApp', 'Email', 'SMS'];
const DISCOUNT = ['Low', 'Medium', 'High'];
const PERSONAS = [
  ['Loyal Trendsetters', 'Buy new arrivals within a week of launch'],
  ['Seasonal Splurgers', 'Large baskets around festivals'],
  ['Steady Regulars', 'Reliable monthly buyers'],
  ['Style Builders', 'Complete outfits rather than single items'],
] as const;

export function buildCustomers(count: number, baseSpend: number, baseOrders: number, dormantDays: number) {
  return Array.from({ length: count }, (_, i) => {
    const orders = Math.max(1, baseOrders + (i % 4) - 1);
    const aov = Math.round(baseSpend * (0.8 + ((i * 7) % 9) / 20));
    const persona = PERSONAS[i % PERSONAS.length];
    const days = dormantDays + ((i * 13) % 40);
    return {
      customer_id: `cust-${i + 1}`,
      customer_name: `${FIRST[i % FIRST.length]} ${LAST[(i * 3) % LAST.length]}`,
      total_spent: aov * orders,
      total_orders: orders,
      avg_order_value: aov,
      last_order_date: ago(days * DAY),
      days_since_last_order: days,
      favorite_category: CATEGORIES[i % CATEGORIES.length],
      preferred_channel: CHANNELS[i % 2],
      discount_affinity: DISCOUNT[i % DISCOUNT.length],
      persona_name: persona[0],
      persona_description: persona[1],
    };
  });
}

export const DEMO_PERSONA_ROWS = [
  { persona_name: 'Loyal Trendsetters', persona_description: 'Buy new arrivals within a week of launch', customer_count: 184, total_spent: 1_240_000, average_spend: 6739, revenue_share: 34, average_orders: 7.2, average_days_since_last_order: 21 },
  { persona_name: 'Seasonal Splurgers', persona_description: 'Large baskets around festivals', customer_count: 267, total_spent: 980_000, average_spend: 3670, revenue_share: 27, average_orders: 3.4, average_days_since_last_order: 64 },
  { persona_name: 'Steady Regulars', persona_description: 'Reliable monthly buyers', customer_count: 412, total_spent: 860_000, average_spend: 2087, revenue_share: 24, average_orders: 5.1, average_days_since_last_order: 33 },
  { persona_name: 'Style Builders', persona_description: 'Complete outfits rather than single items', customer_count: 231, total_spent: 360_000, average_spend: 1558, revenue_share: 10, average_orders: 2.8, average_days_since_last_order: 78 },
  { persona_name: 'Curious Browsers', persona_description: 'Tried you once, price sensitive', customer_count: 386, total_spent: 180_000, average_spend: 466, revenue_share: 5, average_orders: 1.1, average_days_since_last_order: 142 },
];

export function buildPersonaCustomers(personaName: string) {
  const row = DEMO_PERSONA_ROWS.find((r) => r.persona_name === personaName) ?? DEMO_PERSONA_ROWS[0];
  return buildCustomers(12, row.average_spend / Math.max(1, row.average_orders), Math.round(row.average_orders), row.average_days_since_last_order ?? 30).map((c, i) => ({
    ...c,
    second_favorite_category: CATEGORIES[(i + 2) % CATEGORIES.length],
    dominant_price_band: ['Mid', 'Premium', 'Value'][i % 3],
    category_diversity_score: 0.4 + (i % 5) / 10,
    persona_name: row.persona_name,
    persona_description: row.persona_description,
    confidence_score: 0.72 + (i % 4) / 20,
  }));
}

export const DEMO_INTELLIGENCE = {
  totalCustomers: DEMO_TOTAL_CUSTOMERS,
  totalOrders: 5236,
  revenue: 3_620_000,
  avgOrderValue: 691,
  customerHealth: { active: 702, atRisk: 389, dormant: 389 },
  topCustomers: [
    { name: 'Ishita Iyer', totalSpent: 48_900 },
    { name: 'Rohan Mehta', totalSpent: 44_250 },
    { name: 'Meera Nair', totalSpent: 41_700 },
  ],
};

const campaignBase = {
  company_id: DEMO_COMPANY_ID,
  expected_outcome: null,
  reasoning: null,
  approved_at: null,
  launched_at: null,
  completed_at: null,
};

export const DEMO_CAMPAIGNS: CampaignWithMetrics[] = [
  {
    ...campaignBase,
    id: 'camp-festive',
    opportunity_id: 'opp-festive-launch',
    name: 'Festive Preview — Early Access',
    objective: 'Capture festive spend before competitors reach high-basket buyers',
    channel: 'WhatsApp',
    offer: 'Early access plus free gift wrap',
    message_angle: 'Exclusivity',
    message_content:
      'Hi Aarav, the festive collection is here, and you get first look before it opens to everyone. Reserve your favourites today and we will gift wrap them for free. 🎁',
    expected_outcome: '16% conversion, ₹1.4L revenue',
    reasoning: 'Highest historical festive spend share of any segment.',
    status: 'Launched',
    created_at: ago(6 * DAY),
    updated_at: ago(2 * DAY),
    approved_at: ago(5 * DAY),
    launched_at: ago(2 * DAY),
    audience_size: 189,
    communications_sent: 189,
    communications_delivered: 178,
    communications_read: 131,
    communications_clicked: 47,
    communications_failed: 11,
    case_status: 'READY_FOR_APPROVAL',
  },
  {
    ...campaignBase,
    id: 'camp-churn',
    opportunity_id: 'opp-churn-risk',
    name: 'Stay in Style — Retention Picks',
    objective: 'Re-engage repeat buyers whose purchase gap is growing',
    channel: 'Email',
    offer: 'Personalised picks in their favourite category',
    message_angle: 'Personalisation',
    message_content:
      'Hi Meera, we noticed you love knitwear. Here are five new arrivals picked just for you. Take 10% off your next order this week.',
    status: 'Draft',
    created_at: ago(1 * DAY),
    updated_at: ago(1 * DAY),
    audience_size: 143,
    communications_sent: 0,
    communications_delivered: 0,
    communications_read: 0,
    communications_clicked: 0,
    communications_failed: 0,
    case_status: 'READY_FOR_APPROVAL',
  },
];

export function buildDraft(opp: Opportunity): GeneratedCampaign {
  const channel = /email/i.test(opp.recommended_action) ? 'Email' : /sms/i.test(opp.recommended_action) ? 'SMS' : 'WhatsApp';
  return {
    name: opp.title,
    objective: opp.description,
    channel,
    offer: 'A personal offer tied to their last purchase',
    message_angle: 'Personal and timely',
    campaign_content: `Hi Ishita, it has been a while. We saved something for you based on what you loved last time. Tap to see it before it is gone.`,
    expected_outcome: `${opp.predicted_conversion_rate ?? 10}% conversion, ₹${Math.round(opp.potential_revenue / 1000)}K revenue`,
    reasoning: opp.ai_summary,
  };
}

export const DEMO_ANALYTICS = (campaignId: string) => {
  const campaign = DEMO_CAMPAIGNS.find((c) => c.id === campaignId) ?? DEMO_CAMPAIGNS[0];
  return {
    campaign: {
      id: campaign.id,
      name: campaign.name,
      objective: campaign.objective,
      channel: campaign.channel,
      status: 'Completed',
      launched_at: campaign.launched_at ?? ago(2 * DAY),
      potential_revenue: 141000,
      confidence_score: 79,
    },
    funnel: { targeted: 189, sent: 189, delivered: 178, read: 131, clicked: 47, failed: 11 },
    personaBreakdown: [
      { persona_name: 'Seasonal Splurgers', count: 82, percentage: 43 },
      { persona_name: 'Loyal Trendsetters', count: 57, percentage: 30 },
      { persona_name: 'Style Builders', count: 31, percentage: 17 },
      { persona_name: 'Steady Regulars', count: 19, percentage: 10 },
    ],
    timeline: [
      { hour: 0, sent: 189, delivered: 120, read: 40, clicked: 6 },
      { hour: 1, sent: 189, delivered: 165, read: 78, clicked: 15 },
      { hour: 2, sent: 189, delivered: 172, read: 104, clicked: 27 },
      { hour: 4, sent: 189, delivered: 176, read: 121, clicked: 38 },
      { hour: 8, sent: 189, delivered: 178, read: 131, clicked: 47 },
    ],
    insights: {
      learnings: [
        'Messages sent at 7pm were read 2.3x faster than the morning batch.',
        'Seasonal Splurgers clicked at nearly twice the rate of other personas.',
        'Free gift wrap was mentioned by 6 of the 47 customers who clicked.',
      ],
      nextAction: {
        title: 'Follow up with the 84 who read but did not click',
        description: 'Send a reminder with a 48-hour deadline to readers who have not clicked yet.',
        potentialRevenue: 38000,
        confidence: 72,
      },
    },
  };
};

export const DEMO_AGENT = { id: 'agent-growth', name: 'Growth agent', goal: 'Recover lapsed revenue within budget', status: 'active' };

export const DEMO_RUNS = [
  { id: 'run-3', status: 'completed', summary: 'Found 5 opportunities worth ₹4.8L. Drafted 1 campaign for approval.', stepCount: 6, mode: 'manual', startedAt: ago(3 * 3_600_000) },
  { id: 'run-2', status: 'completed', summary: 'Refreshed segments after new orders. No new opportunities.', stepCount: 4, mode: 'manual', startedAt: ago(1 * DAY) },
  { id: 'run-1', status: 'completed', summary: 'First scan. Found 5 opportunities.', stepCount: 6, mode: 'manual', startedAt: ago(2 * DAY) },
];

export const DEMO_STEPS = [
  { id: 's1', node: 'scout', toolName: 'read_customer_metrics', latencyMs: 412, result: { totalCustomers: DEMO_TOTAL_CUSTOMERS, churnRiskCustomers: 389, dormantCustomers: 389, avgOrderValue: 691 } },
  { id: 's2', node: 'scout', toolName: 'find_segment', latencyMs: 238, result: { opportunity_type: 'Dormant VIPs', audienceSize: 76 } },
  { id: 's3', node: 'strategist', toolName: 'estimate_revenue', latencyMs: 91, result: { lowRevenue: 84000, highRevenue: 112000 } },
  { id: 's4', node: 'strategist', toolName: 'draft_campaign', latencyMs: 1830, result: { thought: 'Early-access WhatsApp message fits this audience best.' } },
  { id: 's5', node: 'reviewer', toolName: 'check_guardrails', latencyMs: 64, result: { allowed: true } },
  { id: 's6', node: 'reviewer', toolName: 'request_approval', latencyMs: 12, result: { note: 'Waiting for the owner to approve before anything is sent.' } },
];

export const DEMO_ACTIVITY = [
  { id: 'a1', agentId: 'agent-growth', actionType: 'discovered_opportunity', description: 'Found 76 dormant VIPs worth ₹1.1L', createdAt: ago(2 * 60_000) },
  { id: 'a2', agentId: 'agent-growth', actionType: 'created_campaign', description: 'Drafted "Stay in Style" retention email for 143 customers', createdAt: ago(40 * 60_000) },
  { id: 'a3', agentId: 'agent-growth', actionType: 'sent_messages', description: 'Delivered 178 of 189 festive preview messages', createdAt: ago(5 * 3_600_000) },
  { id: 'a4', agentId: 'agent-growth', actionType: 'achieved_milestone', description: '47 customers clicked the festive preview', createdAt: ago(9 * 3_600_000) },
  { id: 'a5', agentId: 'agent-growth', actionType: 'launched_campaign', description: 'Launched the festive preview on WhatsApp', createdAt: ago(2 * DAY) },
];

export const DEMO_INTEGRATIONS = [
  { kind: 'llm', provider: 'openrouter', mode: 'simulator', status: 'demo', maskedKey: null, lastVerifiedAt: null },
  { kind: 'email', provider: 'resend', mode: 'simulator', status: 'demo', maskedKey: null, lastVerifiedAt: null },
  { kind: 'whatsapp', provider: 'twilio', mode: 'simulator', status: 'demo', maskedKey: null, lastVerifiedAt: null },
];

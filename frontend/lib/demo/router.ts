import type { CampaignWithMetrics, GeneratedCampaign, Opportunity } from '../types';
import {
  DEMO_ACTIVITY, DEMO_AGENT, DEMO_ANALYTICS, DEMO_CAMPAIGNS, DEMO_COMPANY, DEMO_COMPANY_ID, DEMO_INTEGRATIONS,
  DEMO_INTELLIGENCE, DEMO_PERSONA_ROWS, DEMO_RUNS, DEMO_STEPS, DEMO_TOTAL_CUSTOMERS,
  buildCustomers, buildDraft, buildOpportunities, buildPersonaCustomers, hydrateOpportunity,
} from './data';

/**
 * Answers API calls from `lib/api.ts` with sample data when demo mode is on. State lives
 * in module scope, so goals typed, drafts saved and campaigns approved persist for the
 * session and vanish on reload.
 */

const LATENCY_MS = 350;

const created: Opportunity[] = [];
const campaigns: CampaignWithMetrics[] = DEMO_CAMPAIGNS.map((c) => ({ ...c }));
const overrides = new Map<string, Partial<Opportunity>>();

const allOpportunities = (): Opportunity[] =>
  buildOpportunities(created).map((o) => ({ ...o, ...overrides.get(o.opportunity_id) }));

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const delay = (ms = LATENCY_MS) => new Promise((resolve) => setTimeout(resolve, ms));

const GOAL_SHAPES = [
  { type: 'Goal', segment: 'Active', revenue: 64000, conversion: 9, audience: 164 },
  { type: 'Goal', segment: 'Loyal', revenue: 82500, conversion: 12, audience: 121 },
];

function opportunityFromGoal(goal: string): Opportunity {
  const shape = GOAL_SHAPES[created.length % GOAL_SHAPES.length];
  const title = goal.length > 56 ? `${goal.slice(0, 53)}...` : goal;
  return hydrateOpportunity({
    opportunity_id: `opp-goal-${created.length + 1}`,
    opportunity_type: shape.type,
    title: title.charAt(0).toUpperCase() + title.slice(1),
    description: `Built from your goal: "${goal}"`,
    audience_size: shape.audience,
    potential_revenue: shape.revenue,
    confidence_score: 70,
    priority_score: 75,
    supporting_customer_segment: shape.segment,
    recommended_action: 'Send a WhatsApp message with a personal offer',
    audience_definition: { goal },
    trigger_reason: 'Matched against purchase frequency, recency and category affinity across your customers.',
    ai_summary: `In demo mode this opportunity is sized from sample data. With your real data connected, the agent sizes the audience and revenue for "${goal}" from your customers.`,
    predicted_conversion_rate: shape.conversion,
    alternative_strategies: [],
    opportunity_personas: [{ name: 'Steady Regulars', description: 'Reliable monthly buyers' }],
    average_spend: 2600,
    average_orders: 4,
    status: 'Discovered',
  });
}

const REFINE_NOTES: Array<[RegExp, (m: string) => string]> = [
  [/shorter/i, () => 'Hi Ishita, your picks are waiting. Tap to see them before they sell out.'],
  [/urgent/i, () => 'Hi Ishita, last chance. Your picks are held for the next 24 hours only. Tap to claim them.'],
  [/premium/i, () => 'Dear Ishita, a private preview of the new collection awaits you. Reserve your pieces at your leisure.'],
];

function refineMessage(current: string, modifier: string, channel?: string): string {
  const match = REFINE_NOTES.find(([pattern]) => pattern.test(modifier));
  if (match) return match[1](modifier);
  if (!modifier && channel) {
    return channel === 'SMS' ? 'Thread & Needle: your picks are ready. Tap to view. Reply STOP to opt out.' : current;
  }
  return `${current} (${modifier.trim()})`;
}

async function bodyOf(init?: RequestInit): Promise<Record<string, unknown>> {
  if (typeof init?.body !== 'string') return {};
  try {
    return JSON.parse(init.body) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export async function demoFetch(url: string, init: RequestInit = {}): Promise<Response> {
  await delay();
  const { pathname } = new URL(url, window.location.origin);
  const path = pathname.replace(/^.*\/api/, '');
  const method = (init.method ?? 'GET').toUpperCase();
  const body = await bodyOf(init);
  const seg = path.split('/').filter(Boolean).map(decodeURIComponent);

  if (path === '/companies/me') return json({ success: true, data: DEMO_COMPANY });
  if (path.startsWith('/onboarding/')) return json({ success: true, sessionId: 'demo-session' });
  if (seg[0] === 'ingestion-status') return json({ step: 'completed', progress: 100, message: 'Done', status: 'completed' });
  if (path === '/intelligence-preview') return json(DEMO_INTELLIGENCE);
  if (path === '/analytics/intelligence-brief') return json({ success: true, data: null });
  if (path === '/activity-stream') return json({ success: true, data: DEMO_ACTIVITY });
  if (path === '/integrations') return json({ success: true, available: true, data: DEMO_INTEGRATIONS });
  if (seg[0] === 'integrations') return json({ success: true, data: DEMO_INTEGRATIONS[0] });
  if (path === '/billing/status') return json({ success: true, data: { plan: 'free', subscriptionStatus: null, configured: false } });

  if (seg[0] === 'personas') {
    if (seg[1]) return json({ success: true, data: { personaName: seg[1], customers: buildPersonaCustomers(seg[1]), personas: DEMO_PERSONA_ROWS } });
    const totalRevenue = DEMO_PERSONA_ROWS.reduce((sum, r) => sum + r.total_spent, 0);
    return json({
      success: true,
      data: { companyId: DEMO_COMPANY_ID, totalCustomers: DEMO_TOTAL_CUSTOMERS, totalPersonas: DEMO_PERSONA_ROWS.length, totalRevenue, personaDistribution: DEMO_PERSONA_ROWS },
    });
  }

  if (seg[0] === 'opportunities') {
    const list = allOpportunities();
    if ((method === 'GET' && !seg[1]) || seg[1] === 'generate') {
      const sorted = [...list].sort((a, b) => b.priority_score - a.priority_score);
      return json({
        success: true,
        data: {
          generatedAt: new Date().toISOString(),
          companyId: DEMO_COMPANY_ID,
          totalCustomers: DEMO_TOTAL_CUSTOMERS,
          totalOpportunities: list.length,
          totalRevenuePotential: list.reduce((sum, o) => sum + o.potential_revenue, 0),
          topOpportunities: sorted.slice(0, 3),
          opportunityDistribution: sorted,
          validation: { everyOpportunityHasAudience: true, everyOpportunityHasSummary: true, confidenceScoresPopulated: true, opportunityCountReasonable: true },
        },
      });
    }
    if (seg[1] === 'create-from-goal') {
      await delay(1200);
      const opp = opportunityFromGoal(String(body.goal ?? 'Grow repeat revenue'));
      created.unshift(opp);
      return json({ success: true, data: opp });
    }
    const opp = list.find((o) => o.opportunity_id === seg[1]);
    if (!opp) return json({ error: 'Not found' }, 404);
    if (seg[2] === 'refine') {
      const modifier = String(body.modifier ?? '');
      const bump = /vip/i.test(modifier) ? { audience_size: Math.round(opp.audience_size * 0.4), potential_revenue: Math.round(opp.potential_revenue * 1.15) } : { potential_revenue: Math.round(opp.potential_revenue * 1.08) };
      overrides.set(opp.opportunity_id, { ...overrides.get(opp.opportunity_id), ...bump, customer_count: bump.audience_size ?? opp.customer_count });
      return json({ success: true, data: { ...opp, ...bump } });
    }
    return json({ success: true, data: { opportunity: opp, customers: buildCustomers(Math.min(opp.audience_size, 24), opp.average_spend, opp.average_orders, 70) } });
  }

  if (seg[0] === 'campaigns') {
    if (method === 'GET' && !seg[1]) {
      return json({ success: true, data: campaigns, meta: { page: 1, limit: campaigns.length, total: campaigns.length, pages: 1 } });
    }
    if (seg[1] === 'generate') {
      await delay(1400);
      const opp = allOpportunities().find((o) => o.opportunity_id === body.opportunityId);
      if (!opp) return json({ error: 'Not found' }, 404);
      return json({ success: true, data: { campaign: buildDraft(opp) } });
    }
    if (method === 'POST' && !seg[1]) {
      const opportunityId = String(body.opportunityId);
      const existing = campaigns.find((c) => c.opportunity_id === opportunityId);
      if (existing) return json({ success: true, data: existing });
      const draft = body.campaign as GeneratedCampaign;
      const saved: CampaignWithMetrics = {
        id: `camp-${campaigns.length + 1}`, company_id: DEMO_COMPANY_ID, opportunity_id: opportunityId,
        name: draft.name, objective: draft.objective, channel: draft.channel, offer: draft.offer, message_angle: draft.message_angle,
        message_content: draft.campaign_content, expected_outcome: draft.expected_outcome, reasoning: draft.reasoning,
        status: 'Draft', created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
        approved_at: null, launched_at: null, completed_at: null,
        audience_size: allOpportunities().find((o) => o.opportunity_id === opportunityId)?.audience_size ?? 0,
        communications_sent: 0, communications_delivered: 0, communications_read: 0, communications_clicked: 0, communications_failed: 0,
        case_status: 'READY_FOR_APPROVAL',
      };
      campaigns.unshift(saved);
      return json({ success: true, data: saved });
    }
    const campaign = campaigns.find((c) => c.id === seg[1]);
    if (!campaign) return json({ error: 'Campaign not found' }, 404);
    if (seg[2] === 'analytics') return json({ success: true, data: DEMO_ANALYTICS(campaign.id) });
    if (seg[2] === 'refine') {
      const message = refineMessage(campaign.message_content, String(body.modifier ?? ''), body.channel as string | undefined);
      campaign.message_content = message;
      if (body.channel) campaign.channel = String(body.channel);
      return json({ success: true, data: { message_content: message } });
    }
    if (seg[2] === 'approve') campaign.status = 'Approved';
    if (seg[2] === 'reject' || seg[2] === 'cancel') campaign.status = 'Cancelled';
    if (seg[2] === 'launch') return json({ error: 'Launching is disabled in demo mode. Nothing is ever sent.' }, 403);
    return json({ success: true, data: campaign });
  }

  if (seg[0] === 'agents') {
    if (!seg[1]) return json({ success: true, data: [DEMO_AGENT], meta: { page: 1, limit: 20, total: 1, pages: 1 } });
    if (seg[2] === 'runs' && seg[3]) {
      const run = DEMO_RUNS.find((r) => r.id === seg[3]) ?? DEMO_RUNS[0];
      return json({ success: true, data: { ...run, steps: DEMO_STEPS.slice(0, run.stepCount) } });
    }
    if (seg[2] === 'runs') return json({ success: true, available: true, data: DEMO_RUNS });
    if (seg[2] === 'run') return json({ success: true, message: 'Agent execution triggered' });
    return json({ success: true, data: DEMO_AGENT });
  }

  return json({ error: `No demo data for ${method} ${path}` }, 404);
}

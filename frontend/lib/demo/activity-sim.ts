import { DEMO_ACTIVITY } from './data';

export const SIM = { gapMs: 3000, anchorOffsetMs: 5000, keepRuns: 12 } as const;

const RUN_ID_PREFIX = 'demo-run-';

type Scenario = {
  segment: string;
  audience: number;
  revenue: string;
  channel: string;
  actionType: 'discovered_opportunity' | 'created_campaign';
  href: string;
  outcomeLabel: string;
};

const SCENARIOS: readonly Scenario[] = [
  { segment: 'Lapsed repeat buyers', audience: 112, revenue: '₹1.4L', channel: 'WhatsApp', actionType: 'discovered_opportunity', href: '/opportunities/opp-dormant-vips', outcomeLabel: 'Open opportunity' },
  { segment: 'Denim browsers', audience: 64, revenue: '₹52K', channel: 'Email', actionType: 'created_campaign', href: '/campaigns', outcomeLabel: 'Review campaign' },
  { segment: 'First-time buyers', audience: 203, revenue: '₹88K', channel: 'WhatsApp', actionType: 'discovered_opportunity', href: '/opportunities/opp-new-reactivation', outcomeLabel: 'Open opportunity' },
];

const AUDIENCE_DRIFT = 13;
const AUDIENCE_DRIFT_MOD = 40;

const stepPlan = (s: Scenario, audience: number) => [
  { node: 'scout', toolName: 'read_customer_metrics', label: 'Reading customer metrics', durationMs: 900, tokens: { in: 420, out: 96 }, args: { window: '90d' }, result: { totalCustomers: 1480, orders: 5320 } },
  { node: 'scout', toolName: 'score_customers', label: 'Scoring customers by recency and spend', durationMs: 1700, tokens: { in: 1880, out: 310 }, args: { model: 'rfm-v2' }, result: { scored: 1480, topDecile: 148 } },
  { node: 'scout', toolName: 'find_segment', label: `Finding ${s.segment.toLowerCase()}`, durationMs: 1100, tokens: { in: 760, out: 142 }, args: { segment: s.segment }, result: { audienceSize: audience } },
  { node: 'strategist', toolName: 'estimate_revenue', label: 'Estimating revenue lift', durationMs: 800, tokens: { in: 540, out: 88 }, args: { audience, channel: s.channel }, result: { range: s.revenue } },
  { node: 'strategist', toolName: 'draft_campaign', label: `Drafting the ${s.channel} message`, durationMs: 2200, tokens: { in: 1240, out: 520 }, args: { tone: 'warm', channel: s.channel }, result: { thought: `${s.channel} fits this audience best.` } },
  { node: 'reviewer', toolName: 'check_compliance', label: 'Checking compliance and opt-ins', durationMs: 700, tokens: { in: 380, out: 44 }, args: { rules: ['opt_in', 'send_window'] }, result: { allowed: true, optedIn: audience } },
  { node: 'reviewer', toolName: 'request_approval', label: 'Waiting for owner approval', durationMs: 400, tokens: { in: 120, out: 30 }, args: { mode: 'manual' }, result: { note: 'Nothing is sent until you approve.' } },
];

type SimRun = { k: number; scenario: Scenario; audience: number; start: number; end: number; steps: ReturnType<typeof stepPlan> };

const ANCHOR = Date.now() - SIM.anchorOffsetMs;
const iso = (ms: number) => new Date(ms).toISOString();

function runsAt(now: number): SimRun[] {
  const runs: SimRun[] = [];
  let start = ANCHOR;
  for (let k = 0; start <= now; k++) {
    const scenario = SCENARIOS[k % SCENARIOS.length];
    const audience = scenario.audience + ((k * AUDIENCE_DRIFT) % AUDIENCE_DRIFT_MOD);
    const steps = stepPlan(scenario, audience);
    const end = start + steps.reduce((t, s) => t + s.durationMs, 0);
    runs.push({ k, scenario, audience, start, end, steps });
    start = end + SIM.gapMs;
  }
  return runs.slice(-SIM.keepRuns);
}

function walk(run: SimRun, now: number) {
  let cursor = run.start;
  return run.steps
    .map((s, i) => {
      const startedAt = cursor;
      cursor += s.durationMs;
      const status = now >= cursor ? 'done' : now >= startedAt ? 'running' : 'pending';
      return { ...s, id: `${RUN_ID_PREFIX}${run.k}-s${i}`, status, startedAt: iso(startedAt), latencyMs: status === 'done' ? s.durationMs : Math.max(0, Math.round(now - startedAt)) };
    })
    .filter((s) => s.status !== 'pending');
}

export function demoActivityAt(now: number) {
  const feed = runsAt(now)
    .reverse()
    .map((r) => {
      const runId = `${RUN_ID_PREFIX}${r.k}`;
      if (now < r.end) {
        const current = walk(r, now).find((s) => s.status === 'running');
        return { id: runId, agentId: 'agent-growth', actionType: r.scenario.actionType, description: current?.label ?? 'Starting a new pass', createdAt: iso(r.start), details: { status: 'running', runId } };
      }
      const description =
        r.scenario.actionType === 'discovered_opportunity'
          ? `Found ${r.audience} ${r.scenario.segment.toLowerCase()} worth ${r.scenario.revenue}`
          : `Drafted a campaign for ${r.audience} ${r.scenario.segment.toLowerCase()} via ${r.scenario.channel}`;
      return {
        id: `demo-evt-${r.k}`,
        agentId: 'agent-growth',
        actionType: r.scenario.actionType,
        description,
        createdAt: iso(r.end),
        details: { runId, reasoning: `${r.scenario.channel} reached this group best in past campaigns, and every recipient has opted in.`, metrics: { Audience: r.audience, 'Est. revenue': r.scenario.revenue, Channel: r.scenario.channel } },
      };
    });
  return [...feed, ...DEMO_ACTIVITY];
}

export function demoRunAt(runId: string, now: number) {
  const k = Number(runId.slice(RUN_ID_PREFIX.length));
  const run = runsAt(now).find((r) => r.k === k);
  if (!run) return null;
  const finished = now >= run.end;
  return {
    id: runId,
    status: finished ? 'finished' : 'running',
    goal: `Find ${run.scenario.segment.toLowerCase()} and prepare an outreach`,
    summary: finished ? `Found ${run.audience} ${run.scenario.segment.toLowerCase()} worth ${run.scenario.revenue}. Waiting for your approval.` : '',
    startedAt: iso(run.start),
    stepCount: run.steps.length,
    links: finished ? [{ label: run.scenario.outcomeLabel, href: run.scenario.href }] : [],
    steps: walk(run, now),
  };
}

export const latestDemoRun = (now: number) => {
  const run = runsAt(now).at(-1)!;
  const detail = demoRunAt(`${RUN_ID_PREFIX}${run.k}`, now)!;
  return { id: detail.id, status: detail.status, summary: detail.summary, startedAt: detail.startedAt, stepCount: detail.stepCount, goal: detail.goal };
};

export const isDemoRunId = (id: string) => id.startsWith(RUN_ID_PREFIX);

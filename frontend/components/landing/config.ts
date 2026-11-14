import type { OrbState } from 'thinking-orbs';

export const GITHUB_URL = 'https://github.com/Mithurn/GROWTH-OS';
export const AUTHOR_URL = 'https://github.com/Mithurn';

export const NAV_LINKS = [
  { href: '#workflow', label: 'Workflow' },
  { href: '#product', label: 'Product' },
  { href: '#architecture', label: 'Trust' },
] as const;

export const STAGES = [
  { id: 'observe', label: 'Observe', orb: 'searching', body: 'Reads every customer and order, then scores recency, frequency and spend for each one.' },
  { id: 'decide', label: 'Decide', orb: 'solving', body: 'Deterministic rules find seven kinds of opportunity and size the audience and the revenue at stake.' },
  { id: 'draft', label: 'Draft', orb: 'composing', body: 'Writes channel-ready copy and three variants for that audience. Refine it in plain language.' },
  { id: 'launch', label: 'Launch', orb: 'connecting', body: 'Sends only after you approve, through durable jobs, and reports back over signed webhooks.' },
] as const satisfies readonly { id: string; label: string; orb: OrbState; body: string }[];

export const CONSOLE = {
  path: 'growthos / agent / run',
  command: 'Find customers worth winning back and draft the campaign',
  lines: [
    { stage: 0, text: 'Reading 1,480 customers and their order history' },
    { stage: 0, text: 'Scored recency, frequency and spend for every customer' },
    { stage: 1, text: 'Rule matched: dormant VIPs, 76 customers' },
    { stage: 1, text: 'Sized the audience at 1.1L of recoverable revenue' },
    { stage: 2, text: 'Drafted a WhatsApp offer in three variants' },
    { stage: 3, text: 'Queued for approval. Nothing is sent until you say so' },
  ],
  result: {
    label: 'Opportunity ready',
    title: 'Win back 76 dormant VIPs',
    metrics: [
      { label: 'Recoverable', value: '1.1L' },
      { label: 'Audience', value: '76' },
      { label: 'Variants', value: '3' },
    ],
  },
} as const;

export const RUN_TIMING = {
  tickMs: 60,
  charsPerTick: 1,
  pauseTicks: 8,
  lineTicks: 17,
  resultTicks: 8,
} as const;

export const STATS = [
  { value: '~60s', label: 'from uploaded customers to ranked opportunities' },
  { value: '1 tap', label: 'to approve a draft. Nothing sends without it' },
  { value: '0', label: 'messages to customers who have not opted in' },
  { value: '3', label: 'channels: WhatsApp, email and SMS' },
] as const;

export const BENTO = [
  {
    id: 'opportunities',
    eyebrow: 'Locate revenue',
    title: 'Opportunities arrive sized and ranked',
    body: 'Who they are, how many, and what recovering them is worth. Ask for a goal in plain language and the agent builds one on demand.',
    shot: '/shots/opportunity-v2.jpg',
    alt: 'Opportunity detail showing audience intelligence, key signals and the recommended campaign',
    span: 'lg:col-span-3',
    beam: true,
  },
  {
    id: 'campaigns',
    eyebrow: 'Draft the campaign',
    title: 'Written for the audience, not a template',
    body: 'Preview it as the customer will see it, then steer with a sentence: shorter, more urgent, more premium.',
    shot: '/shots/campaign-v2.jpg',
    alt: 'Campaign builder with a WhatsApp preview and refinement controls',
    span: 'lg:col-span-3',
    beam: false,
  },
  {
    id: 'analytics',
    eyebrow: 'Track results',
    title: 'Watch the funnel move',
    body: 'Sent, delivered, read and clicked. Duplicate and out-of-order events cannot push a number backward.',
    shot: '/shots/analytics-v2.jpg',
    alt: 'Campaign analytics with conversion flow, audience mix and channel performance',
    span: 'lg:col-span-3',
    beam: false,
  },
  {
    id: 'personas',
    eyebrow: 'Know the customer',
    title: 'Personas that come from your data',
    body: 'A model names the clusters that actually exist, with the spend, recency and category behaviour behind each.',
    shot: '/shots/personas-v2.jpg',
    alt: 'Customer personas with spend, orders and favourite category',
    span: 'lg:col-span-3',
    beam: false,
  },
] as const;

export const BOUNDARY = [
  { code: 'Customer scoring and recency', model: 'Persona names and descriptions' },
  { code: 'Which opportunities are worth chasing', model: 'Why an opportunity matters, in plain words' },
  { code: 'Audience size and revenue estimates', model: 'Campaign copy and variants' },
  { code: 'Delivery tracking and results', model: 'Rewrites when you ask for a change' },
] as const;

export const ARCHITECTURE = [
  { title: 'Nothing sends without you', body: 'The agent drafts, you approve. Every campaign waits for your decision before a single message leaves.' },
  { title: 'Consent comes first', body: 'Only customers who opted in on that channel are ever messaged. Anyone without consent or contact details is left out.' },
  { title: 'Your data stays yours', body: 'Every workspace is isolated at the database level. One customer account can never see another.' },
  { title: 'Results you can trust', body: 'Messages are retried until they land, and duplicate or out-of-order delivery reports never inflate your numbers.' },
] as const;

export const REVEAL = { threshold: 0.15, rootMargin: '0px 0px -8% 0px' } as const;

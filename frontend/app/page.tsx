import Image from 'next/image';
import Link from 'next/link';
import { DM_Sans } from 'next/font/google';
import { BackendStatusPill } from '@/components/landing/backend-status-pill';
import { BrowserFrame } from '@/components/landing/browser-frame';
import { HeroActions } from '@/components/landing/hero-actions';

const dmSans = DM_Sans({ subsets: ['latin'], weight: ['400', '500', '600', '700'], display: 'swap' });

const GITHUB_URL = 'https://github.com/Mithurn/GROWTH-OS';

const PIPELINE = [
  {
    title: 'Ingest',
    body: 'Customers and orders arrive as CSV. The importer validates, de-duplicates per tenant, and computes RFM scores and behavioural attributes for every customer.',
  },
  {
    title: 'Segment',
    body: 'A model reads the computed metrics and names the personas that actually exist in your data, rather than sorting customers into a fixed template.',
  },
  {
    title: 'Locate revenue',
    body: 'Deterministic rules surface seven opportunity types, including dormant VIPs, churn risk, cross-sell and reactivation. Each carries a sized audience and a revenue estimate.',
  },
  {
    title: 'Draft the campaign',
    body: 'The agent writes channel-appropriate copy and three message variants for the chosen audience. Refine it in plain language until it sounds like you.',
  },
  {
    title: 'Send and measure',
    body: 'Approved campaigns leave through durable recipient jobs and report back over signed webhooks. Duplicate and out-of-order events cannot move the funnel backward.',
  },
  {
    title: 'Track results',
    body: 'Analytics shows sent, delivered, read and clicked events for each campaign, so you can see which messages actually brought customers back.',
  },
];

const BOUNDARY = [
  { code: 'RFM scoring and recency windows', model: 'Persona names and descriptions' },
  { code: 'Opportunity detection rules', model: 'Why an opportunity matters, in prose' },
  { code: 'Audience sizing and revenue estimates', model: 'Campaign copy and variants' },
  { code: 'Delivery state machine and ordering', model: 'Natural-language refinement' },
];

const ARCHITECTURE = [
  {
    title: 'Three deployable services',
    body: 'A Next.js frontend, an Express API, and a separate channel service that models a messaging provider over HTTP, so retries, signatures and out-of-order callbacks are real problems the code solves.',
  },
  {
    title: 'Typed boundaries around the model',
    body: 'Every call runs prompt, JSON parse, Zod validation, then database write, with a retry and a usable fallback. No free-form model output reaches the database or the UI.',
  },
  {
    title: 'Tenancy enforced in the API',
    body: 'Every database transaction carries the authenticated tenant into PostgreSQL. Row-level security and ownership checks both reject cross-tenant access.',
  },
  {
    title: 'Built to sleep, ready to wake',
    body: 'The site and this demo live on Vercel and never go down. The API, worker and channel service run on AWS only when switched on, and the app detects that and falls back to the demo.',
  },
];

const FEATURES = [
  {
    eyebrow: 'Locate revenue',
    title: 'See exactly where revenue is leaking',
    body: 'Opportunities arrive sized and ranked: who they are, how many, and what recovering them is worth. Ask for a goal in plain language and the agent builds one on demand.',
    shot: '/shots/opportunity.jpg',
    alt: 'Opportunity detail showing audience intelligence, key signals and the recommended campaign',
  },
  {
    eyebrow: 'Draft the campaign',
    title: 'A campaign written for the audience, not a template',
    body: 'Copy, channel and offer come from the data. Preview it as the customer will see it, then steer it with a sentence: shorter, more urgent, more premium.',
    shot: '/shots/campaign.jpg',
    alt: 'Campaign builder with a WhatsApp preview and refinement controls',
  },
  {
    eyebrow: 'Track results',
    title: 'Watch the funnel move in real time',
    body: 'Sent, delivered, read and clicked, by persona and by hour. Duplicate and out-of-order provider events cannot push a number backward.',
    shot: '/shots/analytics.jpg',
    alt: 'Campaign analytics with conversion flow, audience mix and channel performance',
  },
  {
    eyebrow: 'Know the customer',
    title: 'Personas that come from your data',
    body: 'A model names the clusters that actually exist in your customers, with the spend, recency and category behaviour behind each one.',
    shot: '/shots/personas.jpg',
    alt: 'Customer personas with spend, orders and favourite category',
  },
];

const TRUST = ['Every send needs your approval', 'Tenant isolation in PostgreSQL', 'Signed, idempotent webhooks', 'Durable, retried delivery'];

const STACK = 'Next.js 16 · React 19 · TypeScript · Tailwind 4 · Express 5 · PostgreSQL · Prisma 7 · Supabase Auth · BullMQ · Redis · Zod · OpenRouter';

export default function LandingPage() {
  return (
    <div className={`${dmSans.className} min-h-screen bg-white text-[#111827]`}>
      <header className="sticky top-0 z-40 border-b border-[#E5E7EB] bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link href="/" aria-label="GrowthOS home">
            <Image src="/logo.png" alt="GrowthOS" width={104} height={29} className="object-contain" priority />
          </Link>
          <nav className="flex items-center gap-6 text-sm font-medium">
            <a href="#how" className="hidden text-[#6B7280] transition-colors hover:text-[#111827] md:block">
              How it works
            </a>
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden text-[#6B7280] transition-colors hover:text-[#111827] sm:block"
            >
              Source
            </a>
            <Link href="/login" className="text-[#6B7280] transition-colors hover:text-[#111827]">
              Sign in
            </Link>
            <Link
              href="/demo"
              className="rounded-lg bg-[#5B4FFF] px-4 py-2 text-white transition-colors hover:bg-[#4B3FE5] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5B4FFF]"
            >
              Try the demo
            </Link>
          </nav>
        </div>
      </header>

      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-[520px] bg-[radial-gradient(60%_60%_at_50%_0%,rgba(91,79,255,0.12),transparent)]"
        />
        <div className="relative mx-auto max-w-6xl px-6 pb-20 pt-20 text-center sm:pt-28">
          <BackendStatusPill />
          <h1 className="mx-auto mt-8 max-w-3xl text-5xl font-bold leading-[1.05] tracking-tight sm:text-6xl">
            Find the revenue you&rsquo;re losing. Win it back.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-[#6B7280]">
            Upload your customer data and GrowthOS finds where revenue is leaking, writes the campaign to recover it, and tracks what converted. You approve the decisions. It does the work.
          </p>
          <div className="mt-10">
            <HeroActions />
          </div>
          <p className="mt-4 text-xs text-[#9CA3AF]">The demo runs in your browser on sample data. No sign-up, nothing is sent.</p>
          <div className="mx-auto mt-16 max-w-5xl text-left">
            <BrowserFrame src="/shots/dashboard.jpg" alt="GrowthOS dashboard showing the highest impact opportunity and live agent activity" priority />
          </div>
        </div>
      </section>

      <section className="border-y border-[#E5E7EB] bg-[#F9FAFB]">
        <ul className="mx-auto grid max-w-6xl gap-4 px-6 py-8 text-sm font-medium text-[#374151] sm:grid-cols-2 lg:grid-cols-4">
          {TRUST.map((item) => (
            <li key={item} className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-[#5B4FFF]" aria-hidden />
              {item}
            </li>
          ))}
        </ul>
      </section>

      {FEATURES.map((feature, index) => (
        <section key={feature.title} className={index % 2 === 0 ? 'bg-white' : 'bg-[#F9FAFB]'}>
          <div className="mx-auto grid max-w-6xl items-center gap-12 px-6 py-24 lg:grid-cols-[1fr_1.4fr]">
            <div className={index % 2 === 1 ? 'lg:order-2' : ''}>
              <p className="text-sm font-semibold text-[#5B4FFF]">{feature.eyebrow}</p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">{feature.title}</h2>
              <p className="mt-4 leading-relaxed text-[#6B7280]">{feature.body}</p>
            </div>
            <div className={index % 2 === 1 ? 'lg:order-1' : ''}>
              <BrowserFrame src={feature.shot} alt={feature.alt} />
            </div>
          </div>
        </section>
      ))}

      <section id="how" className="border-t border-[#E5E7EB] py-24">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">How it works</h2>
          <p className="mt-3 max-w-2xl text-[#6B7280]">Six steps from a CSV file to a campaign with measurable results.</p>
          <ol className="mt-14 grid gap-px overflow-hidden rounded-2xl border border-[#E5E7EB] bg-[#E5E7EB] sm:grid-cols-2 lg:grid-cols-3">
            {PIPELINE.map((step, index) => (
              <li key={step.title} className="bg-white p-8">
                <span className="text-sm font-semibold text-[#5B4FFF]">0{index + 1}</span>
                <h3 className="mt-3 text-lg font-semibold">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[#6B7280]">{step.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-24">
        <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">What code decides, and what the model writes</h2>
        <p className="mt-3 max-w-2xl text-[#6B7280]">The numbers are arithmetic in TypeScript. The model only touches language.</p>
        <div className="mt-12 overflow-hidden rounded-2xl border border-[#E5E7EB]">
          <div className="grid grid-cols-2 bg-[#F9FAFB] text-sm font-semibold">
            <div className="p-4">Code decides</div>
            <div className="border-l border-[#E5E7EB] p-4">Model writes</div>
          </div>
          {BOUNDARY.map((row) => (
            <div key={row.code} className="grid grid-cols-2 border-t border-[#E5E7EB] text-sm">
              <div className="p-4 text-[#111827]">{row.code}</div>
              <div className="border-l border-[#E5E7EB] p-4 text-[#6B7280]">{row.model}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="border-t border-[#E5E7EB] py-24">
        <div className="mx-auto grid max-w-6xl gap-16 px-6 lg:grid-cols-[1fr_1.4fr]">
          <div>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Built to run in production</h2>
            <p className="mt-4 text-[#6B7280]">{STACK}</p>
          </div>
          <dl className="grid gap-10 sm:grid-cols-2">
            {ARCHITECTURE.map((item) => (
              <div key={item.title}>
                <dt className="font-semibold">{item.title}</dt>
                <dd className="mt-2 text-sm leading-relaxed text-[#6B7280]">{item.body}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section className="bg-[#111827] py-24 text-white">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">See it work before you bring your data</h2>
          <p className="mx-auto mt-4 max-w-xl text-[#9CA3AF]">
            Open the demo to walk the whole flow, from opportunity to campaign to results.
          </p>
          <div className="mt-10">
            <HeroActions light />
          </div>
        </div>
      </section>

      <footer className="border-t border-[#E5E7EB]">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-4 px-6 py-8 text-sm text-[#6B7280] sm:flex-row sm:items-center">
          <span>GrowthOS</span>
          <nav className="flex items-center gap-6">
            <Link href="/privacy" className="hover:text-[#111827]">Privacy</Link>
            <Link href="/terms" className="hover:text-[#111827]">Terms</Link>
            <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer" className="hover:text-[#111827]">GitHub</a>
            <a href="https://github.com/Mithurn" target="_blank" rel="noopener noreferrer" className="hover:text-[#111827]">Mithurn</a>
          </nav>
        </div>
      </footer>
    </div>
  );
}

import Image from 'next/image';
import Link from 'next/link';
import { DM_Sans } from 'next/font/google';
import { BackendWarmup } from '@/components/backend-warmup';

const dmSans = DM_Sans({ subsets: ['latin'], weight: ['400', '500', '600', '700'], display: 'swap' });

const GITHUB_URL = 'https://github.com/Mithurn/GROWTH-OS';

function GithubIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className}>
      <path d="M12 .5C5.73.5.5 5.73.5 12a11.5 11.5 0 0 0 7.86 10.92c.58.1.79-.25.79-.55v-1.94c-3.2.7-3.88-1.54-3.88-1.54-.52-1.33-1.28-1.69-1.28-1.69-1.05-.71.08-.7.08-.7 1.16.09 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.46.11-3.05 0 0 .96-.31 3.15 1.18a10.9 10.9 0 0 1 5.74 0c2.18-1.49 3.14-1.18 3.14-1.18.63 1.59.23 2.76.12 3.05.74.81 1.18 1.84 1.18 3.1 0 4.42-2.69 5.39-5.25 5.68.41.36.78 1.06.78 2.14v3.17c0 .3.2.66.8.55A11.5 11.5 0 0 0 23.5 12C23.5 5.73 18.27.5 12 .5Z" />
    </svg>
  );
}

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
    title: 'Built for a free tier that sleeps',
    body: 'The agent loop runs from an authenticated external scheduler, ingestion resumes after interruption, and durable jobs retry provider startup and transient failures.',
  },
];

const STACK = 'Next.js 16 · React 19 · TypeScript · Tailwind 4 · Express 5 · PostgreSQL · Prisma 7 · Supabase Auth · BullMQ · Redis · Zod · OpenRouter';

export default function LandingPage() {
  return (
    <div className={`${dmSans.className} min-h-screen bg-white text-[#111827]`}>
      <BackendWarmup />

      <header className="border-b border-[#E5E7EB]">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link href="/" aria-label="GrowthOS home">
            <Image src="/logo.png" alt="GrowthOS" width={104} height={29} className="object-contain" priority />
          </Link>
          <nav className="flex items-center gap-6 text-sm font-medium">
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
              href="/login?mode=signup"
              className="rounded-lg bg-[#5B4FFF] px-4 py-2 text-white transition-colors hover:bg-[#4B3FE5] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5B4FFF]"
            >
              Create account
            </Link>
          </nav>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-6 pb-24 pt-24 text-center sm:pt-32">
        <p className="mb-6 inline-block rounded-full border border-[#E5E7EB] px-3 py-1 text-xs font-medium text-[#5B4FFF]">
          AI growth agent for retail
        </p>
        <h1 className="mx-auto max-w-3xl text-5xl font-bold leading-[1.05] tracking-tight sm:text-6xl">
          Find the revenue you&rsquo;re losing. Win it back.
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-[#6B7280]">
          Upload your customer data and GrowthOS finds where revenue is leaking, writes the campaign to recover it, and tracks what converted. You approve the decisions. It does the work.
        </p>
        <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href="/login?mode=signup"
            className="w-full rounded-lg bg-[#5B4FFF] px-6 py-3 text-base font-semibold text-white transition-colors hover:bg-[#4B3FE5] sm:w-auto"
          >
            Create account
          </Link>
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-[#E5E7EB] px-6 py-3 text-base font-semibold text-[#111827] transition-colors hover:bg-[#F9FAFB] sm:w-auto"
          >
            <GithubIcon className="h-4 w-4" />
            View source
          </a>
        </div>
      </section>

      <section className="border-t border-[#E5E7EB] bg-[#F9FAFB] py-24">
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
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Start with your own customer data</h2>
          <p className="mx-auto mt-4 max-w-xl text-[#9CA3AF]">Create an account and upload a CSV to see your first opportunities.</p>
          <Link
            href="/login?mode=signup"
            className="mt-10 inline-block rounded-lg bg-white px-6 py-3 text-base font-semibold text-[#111827] transition-colors hover:bg-[#F3F4F6]"
          >
            Create account
          </Link>
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

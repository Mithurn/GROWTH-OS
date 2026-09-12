import Image from 'next/image';
import Link from 'next/link';
import { BackendWarmup } from '@/components/backend-warmup';

const GITHUB_URL = 'https://github.com/Mithurn/GROWTH-OS';

// lucide-react v1 dropped brand marks, and the GitHub logo carries more signal here
// than a generic code glyph would.
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
    body: 'Customers and orders arrive as CSV. The importer validates, de-duplicates on a per-tenant key, and computes RFM scores and behavioural attributes for every customer.',
    detail: 'csv → postgres · re-runnable',
  },
  {
    title: 'Segment',
    body: 'A model reads the computed metrics and names the personas that actually exist in the data, rather than sorting customers into a fixed template of segments.',
    detail: 'metrics → persona narrative',
  },
  {
    title: 'Locate revenue',
    body: 'Deterministic rules surface seven opportunity types — dormant VIPs, churn risk, cross-sell, reactivation and others. Each one carries a sized audience and a revenue estimate.',
    detail: '7 rules · audience + estimate',
  },
  {
    title: 'Draft the campaign',
    body: 'The agent writes channel-appropriate copy and three message variants for the chosen audience. You refine it in plain language until it sounds like you wrote it.',
    detail: 'opportunity → copy + variants',
  },
  {
    title: 'Send and measure',
    body: 'Approved campaigns leave through a provider layer that reports back over signed webhooks. The funnel updates as delivery events land, in order, exactly once.',
    detail: 'hmac webhooks → funnel',
  },
];

// The honest version of "AI-powered". Split straight from the source: the left column
// is arithmetic in TypeScript, the right is the only work handed to a model.
const BOUNDARY = [
  { code: 'RFM scoring and recency windows', model: 'Persona names and descriptions' },
  { code: 'Opportunity detection rules', model: 'Why an opportunity matters, in prose' },
  { code: 'Audience sizing and revenue estimates', model: 'Campaign copy and variants' },
  { code: 'Delivery state machine and ordering', model: 'Natural-language refinement' },
];

const ARCHITECTURE = [
  {
    title: 'Three deployable services',
    body: 'A Next.js frontend, an Express API, and a separate channel service that models a messaging provider over HTTP rather than an in-process function call — so retries, signatures and out-of-order callbacks are real problems the code has to solve.',
  },
  {
    title: 'Typed boundaries around the model',
    body: 'Every call runs prompt → JSON parse → Zod validate → database write, with a retry and a usable fallback. No free-form model output reaches the database or the UI.',
  },
  {
    title: 'Tenancy enforced in the API',
    body: 'Queries use the Supabase service role, which bypasses row-level security entirely. Every route therefore re-checks ownership in Express, and a cross-tenant id returns a 404 rather than a 403.',
  },
  {
    title: 'Built for a free tier that sleeps',
    body: 'The agent loop runs from external cron instead of setInterval, ingestion resumes after a spin-down, and the channel service is woken once before a launch fans out instead of by every recipient at once.',
  },
];

const FLOW = [
  ['frontend', 'vercel'],
  ['api', 'render'],
  ['postgres', 'supabase'],
  ['queue', 'upstash'],
  ['channel', 'render'],
];

const STACK =
  'Next.js 16 · React 19 · TypeScript · Tailwind 4 · Express 5 · PostgreSQL · Prisma 7 · Supabase Auth · BullMQ · Redis · Zod · OpenRouter · Vitest';

/** Mono eyebrow used as the ledger spine down the left of every section. */
function Marker({ index, label }: { index: string; label: string }) {
  return (
    <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-[#6B7280]">
      <span className="text-[#1A1A1A]">{index}</span>
      <span className="mx-2 text-[#D1D5DB]">/</span>
      {label}
    </div>
  );
}

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white text-[#1A1A1A]">
      <BackendWarmup />

      {/* ── Status bar ───────────────────────────────────────────────────────
          A slim ink rail rather than the usual translucent white nav: it reads as
          a system chrome strip, and keeps the only CTA reachable down the page. */}
      <header className="sticky top-0 z-50 bg-[#111318] text-white">
        <div className="mx-auto flex h-11 max-w-[1140px] items-center justify-between px-5 sm:px-8">
          <Link href="/" className="font-mono text-[12px] tracking-[0.16em]">
            GROWTH<span className="text-[#8E84FF]">OS</span>
          </Link>

          <nav className="flex items-center gap-5 font-mono text-[11px] uppercase tracking-[0.14em]">
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden text-[#9AA1B2] transition-colors hover:text-white sm:block"
            >
              Source
            </a>
            <Link href="/login" className="text-[#9AA1B2] transition-colors hover:text-white">
              Sign in
            </Link>
            <Link
              href="/login?mode=signup"
              className="bg-[#5B4FFF] px-3 py-1.5 text-white transition-colors hover:bg-[#4B3FE5] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              Create account
            </Link>
          </nav>
        </div>
      </header>

      {/* ── Masthead ────────────────────────────────────────────────────────── */}
      <div className="border-b border-[#E5E7EB]">
        <div className="mx-auto flex max-w-[1140px] flex-wrap items-end justify-between gap-4 px-5 pb-5 pt-8 sm:px-8">
          <Image
            src="/logo.png"
            alt="GrowthOS"
            width={104}
            height={40}
            className="object-contain"
            priority
          />
          <p className="font-mono text-[11px] uppercase leading-relaxed tracking-[0.16em] text-[#6B7280]">
            Autonomous growth agent
            <span className="mx-2 text-[#D1D5DB]">·</span>
            retail CRM
            <span className="mx-2 text-[#D1D5DB]">·</span>
            built in the open
          </p>
        </div>
      </div>

      {/* ── Hero ────────────────────────────────────────────────────────────
          Left-biased 7/5 split. The right column is the product's own output,
          not a stylised device mock. */}
      <section className="border-b border-[#E5E7EB]">
        <div className="mx-auto grid max-w-[1140px] gap-12 px-5 py-16 sm:px-8 sm:py-24 lg:grid-cols-12 lg:gap-16">
          <div className="lg:col-span-7">
            <div className="animate-rise">
              <Marker index="01" label="What it does" />
            </div>

            <h1
              className="animate-rise mt-7 font-serif text-[46px] font-normal leading-[1.02] tracking-[-0.02em] sm:text-[68px]"
              style={{ animationDelay: '60ms' }}
            >
              Your CRM waits for instructions.
              <br />
              <span className="italic text-[#5B4FFF]">This one doesn’t.</span>
            </h1>

            <p
              className="animate-rise mt-7 max-w-xl text-[17px] leading-[1.65] text-[#5C6270]"
              style={{ animationDelay: '120ms' }}
            >
              GrowthOS reads your customer and order history, finds where revenue is
              leaking, writes the campaign to recover it, and tracks what actually
              converted. You approve the decisions — it does the work.
            </p>

            <div
              className="animate-rise mt-10 flex flex-wrap items-center gap-6"
              style={{ animationDelay: '180ms' }}
            >
              <Link
                href="/login?mode=signup"
                className="group inline-flex h-12 items-center gap-3 bg-[#5B4FFF] px-7 text-[15px] font-semibold text-white transition-colors hover:bg-[#4B3FE5] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1A1A1A]"
              >
                Create an account
                <span className="font-mono transition-transform group-hover:translate-x-0.5">
                  →
                </span>
              </Link>
              <a
                href={GITHUB_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 border-b border-[#D1D5DB] pb-0.5 text-[15px] font-medium text-[#374151] transition-colors hover:border-[#5B4FFF] hover:text-[#5B4FFF]"
              >
                <GithubIcon className="h-4 w-4" />
                Read the source
              </a>
            </div>

            <p
              className="animate-rise mt-7 font-mono text-[11.5px] uppercase tracking-[0.14em] text-[#6B7280]"
              style={{ animationDelay: '240ms' }}
            >
              Upload your own CSVs, or start with 500 sample customers
            </p>
          </div>

          {/* Product proof: a real opportunity as the app renders it. */}
          <div className="animate-rise lg:col-span-5" style={{ animationDelay: '300ms' }}>
            <div className="border border-[#E5E7EB] bg-[#FCFCFD]">
              <div className="flex items-center justify-between border-b border-[#E5E7EB] px-5 py-3">
                <span className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-[#6B7280]">
                  Opportunity · detected
                </span>
                <span className="flex items-center gap-1.5 font-mono text-[10.5px] uppercase tracking-[0.16em] text-[#5C6270]">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#22C55E]" />
                  live
                </span>
              </div>

              <div className="px-5 py-6">
                <p className="font-serif text-[27px] leading-[1.15]">Dormant VIPs</p>
                <p className="mt-2.5 text-[14px] leading-relaxed text-[#5C6270]">
                  76 customers in your top spending decile have not ordered in 90 days.
                  Their median basket is 2.4× the store average.
                </p>

                <dl className="mt-6 grid grid-cols-3 gap-px border-y border-[#E5E7EB] bg-[#E5E7EB]">
                  {[
                    { k: 'Audience', v: '76' },
                    { k: 'Recoverable', v: '₹1.1L', accent: true },
                    { k: 'Confidence', v: '0.82' },
                  ].map((cell) => (
                    <div key={cell.k} className="bg-[#FCFCFD] px-3 py-3.5">
                      <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#6B7280]">
                        {cell.k}
                      </dt>
                      <dd
                        className={`mt-1.5 font-mono text-[19px] tabular-nums ${
                          cell.accent ? 'text-[#5B4FFF]' : 'text-[#1A1A1A]'
                        }`}
                      >
                        {cell.v}
                      </dd>
                    </div>
                  ))}
                </dl>

                <div className="mt-6 space-y-2.5 font-mono text-[11.5px] leading-relaxed text-[#4B5563]">
                  {[
                    ['06:00', 'discovered 4 opportunities'],
                    ['06:01', 'drafted campaign · whatsapp'],
                    ['06:01', 'awaiting your approval'],
                  ].map(([time, event]) => (
                    <div key={event} className="flex gap-3.5">
                      <span className="tabular-nums text-[#6B7280]">{time}</span>
                      <span>{event}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── The inversion ───────────────────────────────────────────────────── */}
      <section className="border-b border-[#E5E7EB] bg-[#FAFAFA]">
        <div className="mx-auto grid max-w-[1140px] gap-10 px-5 py-20 sm:px-8 lg:grid-cols-12 lg:gap-16">
          <div className="lg:col-span-4">
            <Marker index="02" label="The inversion" />
            <h2 className="mt-6 font-serif text-[34px] leading-[1.1] sm:text-[40px]">
              A dashboard is a question. This is an answer.
            </h2>
            <p className="mt-5 text-[15.5px] leading-[1.65] text-[#5C6270]">
              Traditional CRMs hand you a query builder and assume you already know what
              to look for. Almost all of the work is in the knowing.
            </p>
          </div>

          <div className="lg:col-span-8 lg:pt-1">
            {[
              ['Finding the segment', 'You guess which one matters this month', 'Surfaced by the agent, ranked by revenue at risk'],
              ['Building the audience', 'You hand-assemble the filter', 'Already built, sized, and inspectable'],
              ['Writing the message', 'You start from an empty box', 'Drafted per channel, refined in plain language'],
              ['Reading the result', 'You open a report and interpret it', 'The funnel explains itself as events land'],
            ].map(([job, before, after]) => (
              <div
                key={job}
                className="grid gap-2 border-t border-[#E5E7EB] py-5 sm:grid-cols-[180px_1fr_1fr] sm:gap-6"
              >
                <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-[#6B7280]">
                  {job}
                </div>
                <p className="text-[14.5px] leading-relaxed text-[#6B7280] line-through decoration-[#C7CBD4]">
                  {before}
                </p>
                <p className="text-[14.5px] leading-relaxed text-[#1A1A1A]">{after}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pipeline ────────────────────────────────────────────────────────── */}
      <section className="border-b border-[#E5E7EB]">
        <div className="mx-auto max-w-[1140px] px-5 py-20 sm:px-8">
          <Marker index="03" label="The pipeline" />
          <h2 className="mt-6 max-w-2xl font-serif text-[34px] leading-[1.1] sm:text-[40px]">
            CSV in, revenue decisions out
          </h2>
          <p className="mt-5 max-w-xl text-[15.5px] leading-[1.65] text-[#5C6270]">
            Five stages, each one inspectable. Nothing here is a black box you have to
            take on faith.
          </p>

          <ol className="mt-14">
            {PIPELINE.map((stage, i) => (
              <li
                key={stage.title}
                className="grid gap-x-8 gap-y-3 border-t border-[#E5E7EB] py-7 lg:grid-cols-12"
              >
                <div className="lg:col-span-2">
                  <span className="font-mono text-[30px] tabular-nums leading-none text-[#8E95A1]">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                </div>
                <h3 className="font-serif text-[25px] leading-tight lg:col-span-3">
                  {stage.title}
                </h3>
                <p className="max-w-2xl text-[15px] leading-[1.65] text-[#5C6270] lg:col-span-5">
                  {stage.body}
                </p>
                <div className="font-mono text-[11px] uppercase tracking-[0.12em] text-[#6B7280] lg:col-span-2 lg:text-right">
                  {stage.detail}
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ── Where the model is allowed to act ───────────────────────────────── */}
      <section className="border-b border-[#E5E7EB] bg-[#FAFAFA]">
        <div className="mx-auto max-w-[1140px] px-5 py-20 sm:px-8">
          <Marker index="04" label="The boundary" />
          <h2 className="mt-6 max-w-2xl font-serif text-[34px] leading-[1.1] sm:text-[40px]">
            What the model is allowed to be wrong about
          </h2>
          <p className="mt-5 max-w-xl text-[15.5px] leading-[1.65] text-[#5C6270]">
            Money maths, eligibility and delivery state are arithmetic — they belong in
            code that can be tested. Language is the only thing handed to a model.
          </p>

          <div className="mt-12 grid gap-px bg-[#E5E7EB] sm:grid-cols-2">
            <div className="bg-white">
              <p className="px-5 py-4 font-mono text-[10.5px] uppercase tracking-[0.16em] text-[#1A1A1A] sm:px-6">
                Decided by code
              </p>
              {BOUNDARY.map((row) => (
                <div
                  key={row.code}
                  className="border-t border-[#E5E7EB] px-5 py-4 text-[14.5px] text-[#1A1A1A] sm:px-6"
                >
                  {row.code}
                </div>
              ))}
            </div>

            <div className="bg-white">
              <p className="px-5 py-4 font-mono text-[10.5px] uppercase tracking-[0.16em] text-[#5B4FFF] sm:px-6">
                Written by the model
              </p>
              {BOUNDARY.map((row) => (
                <div
                  key={row.model}
                  className="border-t border-[#E5E7EB] px-5 py-4 text-[14.5px] text-[#5C6270] sm:px-6"
                >
                  {row.model}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Architecture ────────────────────────────────────────────────────── */}
      <section className="bg-[#111318] text-white">
        <div className="mx-auto max-w-[1140px] px-5 py-20 sm:px-8 sm:py-24">
          <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-[#8A91A1]">
            <span className="text-white">05</span>
            <span className="mx-2 text-[#3A3F4B]">/</span>
            How it is built
          </div>

          <div className="mt-6 grid gap-10 lg:grid-cols-12 lg:gap-16">
            <div className="lg:col-span-5">
              <h2 className="font-serif text-[34px] leading-[1.1] sm:text-[40px]">
                The interesting part isn’t the prompt
              </h2>
              <p className="mt-5 text-[15.5px] leading-[1.65] text-[#9096A5]">
                Anything can call a language model. The engineering is deciding what it is
                allowed to be wrong about, and containing it when it is.
              </p>

              <div className="mt-10 space-y-px">
                {FLOW.map(([node, host]) => (
                  <div
                    key={node}
                    className="flex items-baseline justify-between border-b border-white/[0.07] py-2.5 font-mono text-[12px]"
                  >
                    <span className="text-white">{node}</span>
                    <span className="text-[#8A91A1]">{host}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="lg:col-span-7">
              <dl className="space-y-px">
                {ARCHITECTURE.map((item) => (
                  <div key={item.title} className="border-t border-white/[0.09] py-6">
                    <dt className="font-serif text-[22px] leading-tight">{item.title}</dt>
                    <dd className="mt-2.5 max-w-2xl text-[14.5px] leading-[1.65] text-[#9096A5]">
                      {item.body}
                    </dd>
                  </div>
                ))}
              </dl>

              <p className="mt-10 font-mono text-[11.5px] leading-[2] text-[#8A91A1]">
                {STACK}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Closing ─────────────────────────────────────────────────────────── */}
      <section className="border-b border-[#E5E7EB]">
        <div className="mx-auto grid max-w-[1140px] gap-8 px-5 py-20 sm:px-8 sm:py-24 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <h2 className="font-serif text-[38px] leading-[1.05] sm:text-[52px]">
              See it find revenue in data
              <br />
              <span className="italic">it has never seen</span>
            </h2>
          </div>
          <div className="lg:col-span-5 lg:pt-3">
            <p className="text-[15.5px] leading-[1.65] text-[#5C6270]">
              Create an account, then upload your own history or evaluate the pipeline on
              500 sample customers and 3,000 orders — imported into your own workspace,
              never a shared sandbox.
            </p>
            <Link
              href="/login?mode=signup"
              className="group mt-8 inline-flex h-12 items-center gap-3 bg-[#5B4FFF] px-7 text-[15px] font-semibold text-white transition-colors hover:bg-[#4B3FE5] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1A1A1A]"
            >
              Create an account
              <span className="font-mono transition-transform group-hover:translate-x-0.5">
                →
              </span>
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────────────────── */}
      <footer className="mx-auto flex max-w-[1140px] flex-col gap-3 px-5 py-10 font-mono text-[11px] uppercase tracking-[0.14em] text-[#6B7280] sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <span>GrowthOS</span>
        <span>
          Built by{' '}
          <a
            href="https://github.com/Mithurn"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#5C6270] transition-colors hover:text-[#5B4FFF]"
          >
            Mithurn Jeromme
          </a>
        </span>
        <a
          href={GITHUB_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 transition-colors hover:text-[#5B4FFF]"
        >
          <GithubIcon className="h-3.5 w-3.5" />
          Source
        </a>
      </footer>
    </div>
  );
}

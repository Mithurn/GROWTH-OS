import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowRight,
  Bot,
  Brain,
  LineChart,
  Radio,
  ShieldCheck,
  Sparkles,
  Target,
  Upload,
  Users,
} from 'lucide-react';
import { BackendWarmup } from '@/components/backend-warmup';

const GITHUB_URL = 'https://github.com/Mithurn/xeno-grow';

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
    icon: Upload,
    title: 'Ingest',
    body: 'Upload customers and orders as CSV. The pipeline validates, cleans, and imports them, then computes RFM scores and behavioural attributes per customer.',
  },
  {
    icon: Users,
    title: 'Segment',
    body: 'An LLM reads the computed metrics and names the personas that actually exist in your data — not a fixed template of segments.',
  },
  {
    icon: Target,
    title: 'Find revenue',
    body: 'Deterministic rules surface seven opportunity types: dormant VIPs, churn risk, cross-sell, VIP reward, and more. Each one carries an audience and a revenue estimate.',
  },
  {
    icon: Sparkles,
    title: 'Write the campaign',
    body: 'The agent drafts channel-appropriate copy for the chosen audience. You edit it in natural language until it sounds like you.',
  },
  {
    icon: Radio,
    title: 'Send and measure',
    body: 'Approved campaigns go out through a provider layer that reports back over signed webhooks. The funnel updates as delivery events land.',
  },
];

const ARCHITECTURE = [
  {
    title: 'Three deployable services',
    body: 'A Next.js frontend on Vercel, an Express API on Render, and a separate channel service that models a real messaging provider over HTTP rather than a function call.',
  },
  {
    title: 'AI reasons, code decides',
    body: 'Opportunity detection, RFM scoring, and analytics are deterministic and auditable. The LLM is scoped to naming personas, explaining findings, and writing copy.',
  },
  {
    title: 'Typed AI boundaries',
    body: 'Every model call follows prompt → JSON parse → Zod validate → database write. No free-form model output reaches the UI or the database.',
  },
  {
    title: 'Delivery you can trust',
    body: 'Webhooks are HMAC-signed, idempotent by event id, and ordered by sequence number, so a retried or out-of-order callback cannot corrupt a communication’s state.',
  },
];

const STACK = [
  'Next.js 16',
  'React 19',
  'TypeScript',
  'Tailwind CSS 4',
  'Express 5',
  'PostgreSQL',
  'Prisma',
  'Supabase Auth',
  'BullMQ + Redis',
  'Zod',
  'OpenRouter',
  'Vitest',
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white text-[#1A1A1A]">
      <BackendWarmup />

      {/* ── Nav ─────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b border-[#E5E7EB] bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Image src="/logo.png" alt="GrowthOS" width={92} height={36} className="object-contain" priority />

          <div className="flex items-center gap-2">
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden items-center gap-1.5 rounded-full px-4 py-2 text-[13px] font-medium text-[#6B7280] transition-colors hover:bg-[#F3F4F6] hover:text-[#1A1A1A] sm:flex"
            >
              <GithubIcon className="h-4 w-4" />
              Source
            </a>
            <Link
              href="/login"
              className="rounded-full px-4 py-2 text-[13px] font-medium text-[#6B7280] transition-colors hover:bg-[#F3F4F6] hover:text-[#1A1A1A]"
            >
              Sign in
            </Link>
            <Link
              href="/login?mode=signup"
              className="flex items-center gap-1.5 rounded-full bg-[#5B4FFF] px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-[#4B3FE5]"
            >
              Get started
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </header>

      {/* ── Hero ────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden border-b border-[#E5E7EB]">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_-10%,rgba(91,79,255,0.10),transparent_60%)]"
        />

        <div className="relative mx-auto max-w-4xl px-6 py-24 text-center sm:py-32">
          <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-[#E5E7EB] bg-[#FAFAFA] px-3.5 py-1.5 text-[12px] font-medium text-[#6B7280]">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#5B4FFF] opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#5B4FFF]" />
            </span>
            Autonomous growth agent
          </div>

          <h1 className="text-[42px] font-black leading-[1.05] tracking-tight sm:text-[64px]">
            Your CRM waits for
            <br />
            instructions.
            <span className="block text-[#5B4FFF]">This one doesn&apos;t.</span>
          </h1>

          <p className="mx-auto mt-7 max-w-xl text-[17px] leading-relaxed text-[#6B7280]">
            GrowthOS reads your customer data, finds where revenue is leaking, writes the
            campaign to recover it, and tracks what actually converted. You approve the
            decisions — it does the work.
          </p>

          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/login?mode=signup"
              className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#5B4FFF] px-7 text-[15px] font-semibold text-white shadow-lg shadow-[#5B4FFF]/20 transition-all hover:-translate-y-0.5 hover:bg-[#4B3FE5] sm:w-auto"
            >
              Create an account
              <ArrowRight className="h-4 w-4" />
            </Link>
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border-2 border-[#E5E7EB] px-7 text-[15px] font-semibold text-[#374151] transition-colors hover:border-[#5B4FFF] hover:text-[#5B4FFF] sm:w-auto"
            >
              <GithubIcon className="h-4 w-4" />
              Read the code
            </a>
          </div>

          <p className="mt-5 text-[13px] text-[#9CA3AF]">
            After you sign in, upload your CSVs or start with 500 sample customers.
          </p>
        </div>
      </section>

      {/* ── The inversion ───────────────────────────────────────────────── */}
      <section className="border-b border-[#E5E7EB] bg-[#FAFAFA]">
        <div className="mx-auto max-w-5xl px-6 py-20">
          <h2 className="max-w-2xl text-[30px] font-black leading-tight tracking-tight sm:text-[38px]">
            A dashboard is a question. This is an answer.
          </h2>
          <p className="mt-4 max-w-2xl text-[16px] leading-relaxed text-[#6B7280]">
            Traditional CRMs hand the marketer a query builder and expect them to already know
            what to look for. Most of the work is in the knowing.
          </p>

          <div className="mt-12 grid gap-5 md:grid-cols-2">
            <div className="rounded-2xl border border-[#E5E7EB] bg-white p-7">
              <p className="text-[11px] font-bold uppercase tracking-widest text-[#9CA3AF]">
                Traditional CRM
              </p>
              <ul className="mt-5 space-y-3.5 text-[15px] text-[#6B7280]">
                <li>You guess which segment matters this month.</li>
                <li>You hand-build the filter that defines it.</li>
                <li>You write the copy from scratch, every time.</li>
                <li>You open a report and interpret it yourself.</li>
              </ul>
            </div>

            <div className="rounded-2xl border-2 border-[#5B4FFF]/25 bg-white p-7 shadow-lg shadow-[#5B4FFF]/5">
              <p className="text-[11px] font-bold uppercase tracking-widest text-[#5B4FFF]">
                GrowthOS
              </p>
              <ul className="mt-5 space-y-3.5 text-[15px] text-[#374151]">
                <li>The agent surfaces the segment that is leaking revenue.</li>
                <li>The audience is already built and sized.</li>
                <li>The campaign arrives drafted, on the right channel.</li>
                <li>The funnel explains itself as events land.</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ── Pipeline ────────────────────────────────────────────────────── */}
      <section className="border-b border-[#E5E7EB]">
        <div className="mx-auto max-w-5xl px-6 py-20">
          <h2 className="text-[30px] font-black leading-tight tracking-tight sm:text-[38px]">
            CSV in, revenue decisions out
          </h2>
          <p className="mt-4 max-w-2xl text-[16px] leading-relaxed text-[#6B7280]">
            Five stages, each one inspectable. Nothing in this pipeline is a black box you have
            to take on faith.
          </p>

          <ol className="mt-12 space-y-3">
            {PIPELINE.map((stage, i) => {
              const Icon = stage.icon;
              return (
                <li
                  key={stage.title}
                  className="group flex gap-5 rounded-2xl border border-[#E5E7EB] bg-white p-6 transition-all hover:border-[#5B4FFF]/30 hover:shadow-lg hover:shadow-[#5B4FFF]/5"
                >
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#EEF2FF] text-[#5B4FFF]">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="flex items-baseline gap-2.5">
                      <span className="text-[11px] font-bold tabular-nums text-[#C7CBD4]">
                        0{i + 1}
                      </span>
                      <h3 className="text-[17px] font-bold">{stage.title}</h3>
                    </div>
                    <p className="mt-1.5 text-[15px] leading-relaxed text-[#6B7280]">
                      {stage.body}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      </section>

      {/* ── Architecture ────────────────────────────────────────────────── */}
      <section className="border-b border-[#E5E7EB] bg-[#0A0E1A] text-white">
        <div className="mx-auto max-w-5xl px-6 py-20">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3.5 py-1.5 text-[12px] font-medium text-[#A89DFF]">
            <ShieldCheck className="h-3.5 w-3.5" />
            How it is built
          </div>

          <h2 className="mt-6 text-[30px] font-black leading-tight tracking-tight sm:text-[38px]">
            The interesting part isn&apos;t the prompt
          </h2>
          <p className="mt-4 max-w-2xl text-[16px] leading-relaxed text-[#8B92A5]">
            Anything can call a language model. The engineering is in deciding what the model is
            allowed to be wrong about, and containing it when it is.
          </p>

          <div className="mt-12 grid gap-5 sm:grid-cols-2">
            {ARCHITECTURE.map((item) => (
              <div
                key={item.title}
                className="rounded-2xl border border-white/10 bg-white/[0.03] p-6"
              >
                <h3 className="text-[16px] font-bold">{item.title}</h3>
                <p className="mt-2.5 text-[14.5px] leading-relaxed text-[#8B92A5]">{item.body}</p>
              </div>
            ))}
          </div>

          {/* Flow */}
          <div className="mt-12 overflow-x-auto">
            <div className="flex min-w-max items-center gap-2.5 rounded-2xl border border-white/10 bg-white/[0.03] p-5 font-mono text-[12.5px] text-[#8B92A5]">
              {[
                { label: 'Frontend', sub: 'Vercel' },
                { label: 'API', sub: 'Render' },
                { label: 'Postgres', sub: 'Supabase' },
                { label: 'Queue', sub: 'Redis' },
                { label: 'Channel', sub: 'Render' },
              ].map((node, i, arr) => (
                <div key={node.label} className="flex items-center gap-2.5">
                  <div className="rounded-lg border border-white/10 bg-[#0A0E1A] px-3.5 py-2 text-center">
                    <div className="font-semibold text-white">{node.label}</div>
                    <div className="mt-0.5 text-[11px] text-[#5B6178]">{node.sub}</div>
                  </div>
                  {i < arr.length - 1 && <span className="text-[#5B6178]">&rarr;</span>}
                </div>
              ))}
            </div>
          </div>

          <div className="mt-10 flex flex-wrap gap-2">
            {STACK.map((tech) => (
              <span
                key={tech}
                className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-[12px] font-medium text-[#A8AEC0]"
              >
                {tech}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── What you can do in the demo ─────────────────────────────────── */}
      <section className="border-b border-[#E5E7EB]">
        <div className="mx-auto max-w-5xl px-6 py-20">
          <h2 className="text-[30px] font-black leading-tight tracking-tight sm:text-[38px]">
            What you can do once you&apos;re in
          </h2>

          <div className="mt-12 grid gap-5 sm:grid-cols-3">
            {[
              {
                icon: Brain,
                title: 'Watch personas form',
                body: 'Load the sample retailer and see the segments the model names from its actual purchase behaviour.',
              },
              {
                icon: Bot,
                title: 'Send the agent a goal',
                body: 'Type a plain-language objective and watch it decide which audience serves that goal and why.',
              },
              {
                icon: LineChart,
                title: 'Launch and track',
                body: 'Approve a campaign and follow real delivery events through the funnel as the provider reports back.',
              },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.title}
                  className="rounded-2xl border border-[#E5E7EB] bg-white p-6 transition-all hover:border-[#5B4FFF]/30 hover:shadow-lg hover:shadow-[#5B4FFF]/5"
                >
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#EEF2FF] text-[#5B4FFF]">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-5 text-[16px] font-bold">{item.title}</h3>
                  <p className="mt-2 text-[14.5px] leading-relaxed text-[#6B7280]">{item.body}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Closing CTA ─────────────────────────────────────────────────── */}
      <section className="border-b border-[#E5E7EB] bg-[#FAFAFA]">
        <div className="mx-auto max-w-3xl px-6 py-24 text-center">
          <h2 className="text-[32px] font-black leading-tight tracking-tight sm:text-[42px]">
            See it find revenue in data
            <br />
            it has never seen
          </h2>
          <p className="mx-auto mt-5 max-w-lg text-[16px] leading-relaxed text-[#6B7280]">
            Create an account, then upload your own data or evaluate the pipeline on 500
            sample customers and 3,000 orders — loaded into your workspace, not a shared sandbox.
          </p>
          <Link
            href="/login?mode=signup"
            className="mt-9 inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[#5B4FFF] px-8 text-[15px] font-semibold text-white shadow-lg shadow-[#5B4FFF]/20 transition-all hover:-translate-y-0.5 hover:bg-[#4B3FE5]"
          >
            Create an account
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <footer className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-9 sm:flex-row">
        <Image src="/logo.png" alt="GrowthOS" width={76} height={30} className="object-contain" />
        <p className="text-[13px] text-[#9CA3AF]">
          Built by{' '}
          <a
            href="https://github.com/Mithurn"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-[#6B7280] underline decoration-[#D1D5DB] underline-offset-2 transition-colors hover:text-[#5B4FFF]"
          >
            Mithurn Jeromme
          </a>
        </p>
        <a
          href={GITHUB_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-[13px] font-medium text-[#6B7280] transition-colors hover:text-[#5B4FFF]"
        >
          <GithubIcon className="h-4 w-4" />
          GitHub
        </a>
      </footer>
    </div>
  );
}

import Link from 'next/link';
import { DM_Sans } from 'next/font/google';
import { Logo } from '@/components/brand/logo';
import { Architecture } from '@/components/landing/architecture';
import { BackendStatusPill } from '@/components/landing/backend-status-pill';
import { ClosingCta } from '@/components/landing/closing-cta';
import { AUTHOR_URL, GITHUB_URL, NAV_LINKS } from '@/components/landing/config';
import { HeroActions } from '@/components/landing/hero-actions';
import { HeroAgent } from '@/components/landing/hero-agent';
import { ProductBento } from '@/components/landing/product-bento';
import { WatchVideoButton } from '@/components/landing/watch-video';
import { Workflow } from '@/components/landing/workflow';

const dmSans = DM_Sans({ subsets: ['latin'], weight: ['400', '500', '600', '700'], display: 'swap' });

const NAV_LOGO_HEIGHT = 30;
const NAV_LINK = 'text-sm text-zinc-400 transition-colors hover:text-white';

export default function LandingPage() {
  return (
    <div className={`${dmSans.className} min-h-screen overflow-x-clip bg-[#06060a] text-zinc-100 antialiased selection:bg-indigo-500/40`}>
      <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-[#06060a]/70 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link href="/" aria-label="GrowthOS home">
            <Logo height={NAV_LOGO_HEIGHT} />
          </Link>
          <nav className="flex items-center gap-6">
            {NAV_LINKS.map((link) => (
              <a key={link.href} href={link.href} className={`${NAV_LINK} hidden md:block`}>
                {link.label}
              </a>
            ))}
            <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer" className={`${NAV_LINK} hidden sm:block`}>
              Source
            </a>
            <Link href="/login" className={NAV_LINK}>
              Sign in
            </Link>
            <Link
              href="/demo"
              className="rounded-full bg-white px-4 py-1.5 text-sm font-semibold text-black transition-colors hover:bg-zinc-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400"
            >
              Try the demo
            </Link>
          </nav>
        </div>
      </header>

      <section className="relative">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:56px_56px] [mask-image:radial-gradient(70%_60%_at_50%_0%,black,transparent)]"
        />
        <div className="relative mx-auto max-w-6xl px-6 pb-24 pt-14 text-center sm:pt-20">
          <BackendStatusPill />
          <h1 className="mx-auto mt-6 max-w-4xl text-[2.6rem] font-semibold leading-[1.04] tracking-tighter text-white sm:text-6xl lg:text-7xl">
            An AI agent that finds the revenue you&rsquo;re losing{' '}
            <span className="bg-gradient-to-r from-indigo-300 via-indigo-400 to-sky-300 bg-clip-text text-transparent">and wins it back.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-zinc-400">
            Upload your customer data. GrowthOS observes it, decides where revenue is leaking, drafts the campaign to recover it, and tracks what converted. You approve every send.
          </p>
          <div className="mt-10">
            <HeroActions />
          </div>
          <div className="mt-3">
            <WatchVideoButton />
          </div>
          <p className="mt-4 text-xs text-zinc-500">The demo runs in your browser on sample data. No sign-up, nothing is sent.</p>
          <div className="mt-16">
            <HeroAgent />
          </div>
        </div>
      </section>

      <Workflow />
      <ProductBento />
      <Architecture />

      <section className="relative border-t border-white/[0.06] py-28">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(50%_70%_at_50%_100%,rgba(91,79,255,0.22),transparent)]"
        />
        <div className="relative">
          <ClosingCta />
        </div>
      </section>

      <footer className="border-t border-white/[0.06]">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-4 px-6 py-8 text-sm text-zinc-500 sm:flex-row sm:items-center">
          <span>GrowthOS</span>
          <nav className="flex items-center gap-6">
            <Link href="/privacy" className="hover:text-white">Privacy</Link>
            <Link href="/terms" className="hover:text-white">Terms</Link>
            <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer" className="hover:text-white">GitHub</a>
            <a href={AUTHOR_URL} target="_blank" rel="noopener noreferrer" className="hover:text-white">Mithurn</a>
          </nav>
        </div>
      </footer>
    </div>
  );
}

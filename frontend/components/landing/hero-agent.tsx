import { Check } from 'lucide-react';
import { AiOrb } from '@/components/ui/ai-orb';

const AGENT_STEPS = [
  'Scoring 1,480 customers on recency, frequency and spend',
  'Finding customers who went quiet after buying often',
  'Sizing the audience and the revenue at stake',
  'Drafting a WhatsApp offer in your brand voice',
] as const;

const RESULT = {
  label: 'Opportunity found',
  title: 'Win back 76 dormant VIPs',
  metrics: [
    { label: 'Recoverable', value: '₹1.1L' },
    { label: 'Audience', value: '76' },
    { label: 'Confidence', value: '88%' },
  ],
} as const;

export function HeroAgent() {
  return (
    <div className="relative mx-auto w-full max-w-2xl text-left">
      <div
        aria-hidden
        className="absolute -inset-x-8 -inset-y-6 -z-10 rounded-[40px] bg-[radial-gradient(60%_60%_at_50%_40%,rgba(91,79,255,0.18),transparent)] blur-2xl"
      />
      <div className="overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white shadow-[0_24px_60px_-24px_rgba(17,24,39,0.3)]">
        <div className="flex items-center gap-3 border-b border-[#F3F4F6] px-5 py-4">
          <AiOrb size="sm" state="searching" />
          <div>
            <p className="text-sm font-semibold text-[#111827]">GrowthOS agent</p>
            <p className="text-xs text-[#6B7280]">Analyzing your customer data</p>
          </div>
        </div>
        <ol className="space-y-3 px-5 py-5">
          {AGENT_STEPS.map((step, index) => (
            <li
              key={step}
              style={{ '--i': index } as React.CSSProperties}
              className="agent-reveal flex items-start gap-3 text-sm text-[#374151]"
            >
              <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-[#EEF2FF] text-[#5B4FFF]">
                <Check className="size-3" aria-hidden />
              </span>
              {step}
            </li>
          ))}
        </ol>
        <div
          style={{ '--i': AGENT_STEPS.length } as React.CSSProperties}
          className="agent-reveal border-t border-[#F3F4F6] bg-[#F8F7FF] px-5 py-5"
        >
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[#5B4FFF]">{RESULT.label}</p>
          <p className="mt-1 text-lg font-semibold tracking-tight text-[#111827]">{RESULT.title}</p>
          <dl className="mt-4 grid grid-cols-3 gap-3">
            {RESULT.metrics.map((metric) => (
              <div key={metric.label} className="rounded-xl border border-[#E5E7EB] bg-white px-3 py-2.5">
                <dt className="text-[11px] uppercase tracking-wider text-[#9CA3AF]">{metric.label}</dt>
                <dd className="mt-0.5 text-base font-bold text-[#111827]">{metric.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </div>
  );
}

import { BorderBeam } from 'border-beam';
import { ArrowRight } from 'lucide-react';
import { AgentAvatar } from '@/components/agent/agent-avatar';
import { AGENT_NAME } from '@/components/agent/agent-config';
import { PrimaryAction } from '@/components/agent/primary-action';
import { formatCurrency } from '@/components/campaign/config';
import { LEARNINGS_LIMIT } from './config';
import { Panel } from './panel';
import type { AnalyticsData } from './model';

export function LearningsPanel({ learnings }: { learnings: string[] }) {
  return (
    <Panel title="What the agent learned" description="Patterns found in this campaign's results" className="h-full">
      <ul className="space-y-2.5">
        {learnings.slice(0, LEARNINGS_LIMIT).map((text, i) => (
          <li key={text} className="flex gap-3 rounded-xl bg-surface-inset p-3.5">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-brand-tint text-xs font-semibold tabular-nums text-primary">{i + 1}</span>
            <p className="text-sm leading-relaxed text-body">{text}</p>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

export function NextMoveCard({ next, className }: { next: AnalyticsData['insights']['nextAction']; className?: string }) {
  return (
    <BorderBeam size="md" theme="light" colorVariant="ocean" strength={0.8} className={className}>
      <section className="flex h-full flex-col gap-5 rounded-2xl border border-border bg-card p-5 shadow-card sm:p-6">
        <div className="flex items-center gap-2.5">
          <AgentAvatar state="idle" size="sm" />
          <div>
            <p className="text-xs font-medium text-primary">Suggested next move</p>
            <p className="text-xs text-muted-foreground">From {AGENT_NAME}</p>
          </div>
        </div>
        <div>
          <h2 className="text-lg font-semibold leading-snug tracking-tight text-foreground">{next.title}</h2>
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{next.description}</p>
        </div>
        <dl className="grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-surface-inset p-3">
            <dt className="text-xs text-muted-foreground">Potential revenue</dt>
            <dd className="mt-1 text-xl font-semibold tabular-nums text-foreground">{formatCurrency(next.potentialRevenue)}</dd>
          </div>
          <div className="rounded-xl bg-surface-inset p-3">
            <dt className="text-xs text-muted-foreground">Confidence</dt>
            <dd className="mt-1 text-xl font-semibold tabular-nums text-foreground">{next.confidence}%</dd>
          </div>
        </dl>
        <div className="mt-auto">
          <PrimaryAction href="/opportunities" className="w-full sm:w-auto">
            Review opportunity <ArrowRight className="size-4" aria-hidden />
          </PrimaryAction>
        </div>
      </section>
    </BorderBeam>
  );
}

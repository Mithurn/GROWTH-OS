'use client';

import { CheckCircle2, Circle, Mail, Rocket, ShieldCheck, XCircle } from 'lucide-react';
import { PrimaryAction } from '@/components/agent/primary-action';
import { cn } from '@/lib/utils';
import { ConsoleCard } from './console';
import { LAUNCH_REQUEST, PREVIEW, formatNumber, type Channel } from './config';

type ApprovalGateProps = {
  approved: boolean;
  approving: boolean;
  demo: boolean;
  channel: Channel;
  message: string;
  audience: number;
  caseStatus?: string | null;
  error?: string | null;
  onApprove: () => void;
  onDiscard: () => void;
};

type Check = { label: string; state: 'pass' | 'warn' | 'fail' };

function buildChecks({ audience, channel, message, caseStatus }: Pick<ApprovalGateProps, 'audience' | 'channel' | 'message' | 'caseStatus'>): Check[] {
  const overSms = channel === 'SMS' && message.length > PREVIEW.smsLimit;
  return [
    { label: `${formatNumber(audience)} customers in the audience`, state: audience > 0 ? 'pass' : 'fail' },
    {
      label: overSms ? `Over ${PREVIEW.smsLimit} characters, splits into parts` : 'Message length fits the channel',
      state: overSms ? 'warn' : 'pass',
    },
    {
      label:
        caseStatus === 'BLOCKED'
          ? 'Reviewer blocked this draft'
          : caseStatus === 'READY_FOR_APPROVAL'
            ? 'Reviewer agent cleared the draft'
            : 'Reviewer agent check pending',
      state: caseStatus === 'BLOCKED' ? 'fail' : caseStatus === 'READY_FOR_APPROVAL' ? 'pass' : 'warn',
    },
  ];
}

const CHECK_ICON = {
  pass: <CheckCircle2 className="size-4 text-emerald-400" aria-hidden />,
  warn: <Circle className="size-4 text-amber-400" aria-hidden />,
  fail: <XCircle className="size-4 text-red-400" aria-hidden />,
} as const;

export function ApprovalGate(props: ApprovalGateProps) {
  const { approved, approving, demo, onApprove, onDiscard, error } = props;
  const checks = buildChecks(props);
  const blocked = checks.some((c) => c.state === 'fail');

  return (
    <ConsoleCard glow>
      <section aria-label="Approval" className="flex flex-col gap-5 p-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <ShieldCheck className="size-4 text-indigo-300" aria-hidden />
            <h2 className="text-sm font-semibold tracking-tight text-white">{approved ? 'Approved by you' : 'Needs your approval'}</h2>
          </div>
          <p className="mt-1 text-xs text-zinc-400">
            {approved ? 'Nothing is sent until the campaign is launched.' : 'The agent will not send anything without your explicit approval.'}
          </p>
          <ul className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-x-5">
            {checks.map((c) => (
              <li key={c.label} className="flex items-center gap-2 text-sm">
                {CHECK_ICON[c.state]}
                <span className={cn('text-zinc-300', c.state === 'fail' && 'text-red-300')}>{c.label}</span>
              </li>
            ))}
          </ul>
          {error && (
            <p role="alert" className="mt-3 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-300">
              {error}
            </p>
          )}
        </div>

        <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-center">
          {approved ? (
            demo ? (
              <button
                type="button"
                disabled
                className="inline-flex h-10 cursor-not-allowed items-center justify-center gap-2 rounded-full border border-white/10 bg-white/5 px-5 text-sm font-medium text-zinc-500"
              >
                <Rocket className="size-4" aria-hidden /> Launch is disabled in the demo
              </button>
            ) : (
              <a
                href={LAUNCH_REQUEST.href}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-indigo-500 px-5 text-sm font-medium text-white transition-colors hover:bg-indigo-400"
              >
                <Mail className="size-4" aria-hidden /> Request launch access
              </a>
            )
          ) : (
            <>
              <button
                type="button"
                onClick={onDiscard}
                disabled={approving}
                className="inline-flex h-10 items-center justify-center rounded-full px-4 text-sm font-medium text-zinc-400 transition-colors hover:text-red-300 disabled:opacity-50"
              >
                Discard
              </button>
              <PrimaryAction onClick={onApprove} disabled={approving || blocked}>
                <CheckCircle2 className="size-4" aria-hidden />
                {approving ? 'Approving' : 'Approve campaign'}
              </PrimaryAction>
            </>
          )}
        </div>
      </section>
    </ConsoleCard>
  );
}

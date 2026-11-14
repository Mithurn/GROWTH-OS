'use client';

import { MetalFx } from 'metal-fx';
import { CheckCircle2, Circle, Loader2, Mail, Rocket, ShieldCheck, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
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
  pass: <CheckCircle2 className="size-4 text-emerald-600" aria-hidden />,
  warn: <Circle className="size-4 text-amber-500" aria-hidden />,
  fail: <XCircle className="size-4 text-red-500" aria-hidden />,
} as const;

export function ApprovalGate(props: ApprovalGateProps) {
  const { approved, approving, demo, onApprove, onDiscard, error } = props;
  const checks = buildChecks(props);
  const blocked = checks.some((c) => c.state === 'fail');

  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-sm" aria-label="Approval">
      <div className="flex items-center gap-2">
        <ShieldCheck className="size-4 text-primary" aria-hidden />
        <h2 className="text-sm font-semibold tracking-tight">{approved ? 'Approved by you' : 'Needs your approval'}</h2>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        {approved ? 'Nothing is sent until the campaign is launched.' : 'The agent will not send anything without your explicit approval.'}
      </p>

      <ul className="mt-4 space-y-2">
        {checks.map((c) => (
          <li key={c.label} className="flex items-center gap-2 text-sm">
            {CHECK_ICON[c.state]}
            <span className={cn(c.state === 'fail' && 'text-red-700')}>{c.label}</span>
          </li>
        ))}
      </ul>

      {error && (
        <p role="alert" className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </p>
      )}

      <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-center">
        {approved ? (
          demo ? (
            <button
              type="button"
              disabled
              className="inline-flex h-10 flex-1 cursor-not-allowed items-center justify-center gap-2 rounded-full bg-muted px-5 text-sm font-semibold text-muted-foreground"
            >
              <Rocket className="size-4" aria-hidden /> Launch is disabled in the demo
            </button>
          ) : (
            <a
              href={LAUNCH_REQUEST.href}
              className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
            >
              <Mail className="size-4" aria-hidden /> Request launch access
            </a>
          )
        ) : (
          <>
            <MetalFx variant="button" preset="chromatic" theme="dark" strength={1} paused={approving || blocked}>
              <button
                type="button"
                onClick={onApprove}
                disabled={approving || blocked}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-foreground px-6 text-sm font-semibold text-background disabled:cursor-not-allowed disabled:opacity-50"
              >
                {approving ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <CheckCircle2 className="size-4" aria-hidden />}
                Approve campaign
              </button>
            </MetalFx>
            <button
              type="button"
              onClick={onDiscard}
              disabled={approving}
              className="inline-flex h-10 items-center justify-center rounded-full px-4 text-sm font-medium text-muted-foreground hover:text-red-600 disabled:opacity-50"
            >
              Discard
            </button>
          </>
        )}
      </div>
    </section>
  );
}

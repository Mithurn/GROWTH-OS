'use client';

import { CheckCircle2, Circle, Mail, Rocket, ShieldCheck, XCircle } from 'lucide-react';
import { PrimaryAction } from '@/components/agent/primary-action';
import { cn } from '@/lib/utils';
import { Panel, alertClass, outlineButtonClass } from './panel';
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
  pass: <CheckCircle2 className="size-4 text-success" aria-hidden />,
  warn: <Circle className="size-4 text-amber-500" aria-hidden />,
  fail: <XCircle className="size-4 text-danger" aria-hidden />,
} as const;

export function ApprovalGate(props: ApprovalGateProps) {
  const { approved, approving, demo, onApprove, onDiscard, error } = props;
  const checks = buildChecks(props);
  const blocked = checks.some((c) => c.state === 'fail');

  return (
    <Panel>
      <section aria-label="Approval" className="p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-brand-tint text-primary">
            <ShieldCheck className="size-[18px]" aria-hidden />
          </span>
          <div>
            <h2 className="text-sm font-semibold tracking-tight text-foreground">{approved ? 'Approved by you' : 'Needs your approval'}</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {approved ? 'Nothing is sent until the campaign is launched.' : 'The agent will not send anything without your explicit approval.'}
            </p>
          </div>
        </div>

        <ul className="mt-5 space-y-2.5 border-t border-line-soft pt-4">
          {checks.map((c) => (
            <li key={c.label} className="flex items-center gap-2.5 text-sm">
              {CHECK_ICON[c.state]}
              <span className={cn('text-body', c.state === 'fail' && 'text-danger')}>{c.label}</span>
            </li>
          ))}
        </ul>

        {error && (
          <p role="alert" className={cn('mt-4', alertClass)}>
            {error}
          </p>
        )}

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
          {approved ? (
            demo ? (
              <button type="button" disabled className={outlineButtonClass}>
                <Rocket className="size-4" aria-hidden /> Launch is disabled in the demo
              </button>
            ) : (
              <PrimaryAction href={LAUNCH_REQUEST.href}>
                <Mail className="size-4" aria-hidden /> Request launch access
              </PrimaryAction>
            )
          ) : (
            <>
              <button type="button" onClick={onDiscard} disabled={approving} className={outlineButtonClass}>
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
    </Panel>
  );
}

'use client';

import { CheckCheck, ChevronLeft, Phone, ShoppingBag, Video } from 'lucide-react';
import { AiOrb } from '@/components/ui/ai-orb';
import { cn } from '@/lib/utils';
import { PREVIEW, TIMING, type Channel } from './config';
import { useTypedText } from './hooks';

type MessagePreviewProps = {
  channel: Channel;
  message: string;
  subject: string;
  offer?: string | null;
  busy?: boolean;
  className?: string;
};

const personalise = (text: string) => text.replace(/\{\{?\s*customer_name\s*\}?\}/gi, PREVIEW.customer);

function LinkCard({ offer }: { offer?: string | null }) {
  return (
    <div className="mt-1.5 overflow-hidden rounded-lg bg-black/[0.04]">
      <div className="flex h-16 items-center justify-center bg-gradient-to-br from-indigo-100 to-indigo-200 text-primary/60">
        <ShoppingBag className="size-5" aria-hidden />
      </div>
      <div className="px-2.5 py-1.5">
        <p className="truncate text-xs font-semibold text-foreground">{offer || 'Exclusive offer'}</p>
        <p className="text-[10px] text-muted-foreground">{PREVIEW.link}</p>
      </div>
    </div>
  );
}

function WhatsApp({ text, offer }: { text: string; offer?: string | null }) {
  return (
    <>
      <div className="flex items-center gap-2 bg-[#075E54] px-3 py-2.5 text-white">
        <ChevronLeft className="size-4" aria-hidden />
        <span className="flex size-7 items-center justify-center rounded-full bg-white/20 text-xs font-bold">
          {PREVIEW.brand[0]}
        </span>
        <div className="min-w-0 flex-1 leading-tight">
          <p className="truncate text-[13px] font-semibold">{PREVIEW.brand}</p>
          <p className="text-[10px] text-white/75">Business account</p>
        </div>
        <Video className="size-4" aria-hidden />
        <Phone className="size-4" aria-hidden />
      </div>
      <div className="flex-1 bg-[#EFEAE2] p-3">
        <div className="max-w-[92%] rounded-xl rounded-tl-none bg-white p-2 shadow-sm">
          <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-foreground">{text}</p>
          <LinkCard offer={offer} />
          <p className="mt-1 flex items-center justify-end gap-1 text-[10px] text-muted-foreground">
            {PREVIEW.time}
            <CheckCheck className="size-3 text-sky-500" aria-hidden />
          </p>
        </div>
      </div>
    </>
  );
}

function Sms({ text }: { text: string }) {
  return (
    <>
      <div className="flex flex-col items-center gap-0.5 border-b border-border bg-muted/60 py-2">
        <span className="flex size-7 items-center justify-center rounded-full bg-border text-xs font-bold text-muted-foreground">
          {PREVIEW.brand[0]}
        </span>
        <span className="text-[10px] font-medium">{PREVIEW.brand}</span>
      </div>
      <div className="flex-1 bg-card p-3">
        <p className="mb-2 text-center text-[10px] text-muted-foreground">Today {PREVIEW.time}</p>
        <div className="max-w-[88%] rounded-2xl rounded-bl-md bg-[#E9E9EB] px-3 py-2">
          <p className="whitespace-pre-wrap text-[13px] leading-snug text-foreground">{text}</p>
        </div>
        <p className={cn('mt-2 text-[10px] tabular-nums', text.length > PREVIEW.smsLimit ? 'text-amber-600' : 'text-muted-foreground')}>
          {text.length}/{PREVIEW.smsLimit} characters
          {text.length > PREVIEW.smsLimit && ', sends as multiple parts'}
        </p>
      </div>
    </>
  );
}

function EmailView({ text, subject, offer }: { text: string; subject: string; offer?: string | null }) {
  return (
    <>
      <div className="space-y-1 border-b border-border bg-card px-4 py-3">
        <p className="truncate text-sm font-semibold">{subject || 'Your offer'}</p>
        <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <span className="rounded bg-muted px-1.5 py-0.5 font-medium text-foreground">{PREVIEW.brand}</span>
          to {PREVIEW.customer}
        </p>
      </div>
      <div className="flex-1 bg-card px-4 py-3">
        <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-foreground">{text}</p>
        <LinkCard offer={offer} />
        <span className="mt-3 inline-block rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground">
          View the offer
        </span>
      </div>
    </>
  );
}

export function MessagePreview({ channel, message, subject, offer, busy, className }: MessagePreviewProps) {
  const typed = useTypedText(personalise(message), TIMING.typeTickMs, TIMING.typeCharsPerTick);

  return (
    <div className={cn('mx-auto w-full max-w-[300px]', className)}>
      <div className="relative rounded-[2rem] border border-white/15 bg-gradient-to-b from-zinc-700 to-zinc-900 p-2 shadow-2xl ring-1 ring-black/40">
        <div className="relative flex h-[440px] flex-col overflow-hidden rounded-[1.5rem] border border-border bg-card">
          <div className="flex items-center justify-between bg-inherit px-5 pb-0.5 pt-2 text-[10px] font-semibold text-muted-foreground">
            <span>{PREVIEW.time}</span>
            <span className="h-1.5 w-12 rounded-full bg-foreground/10" aria-hidden />
            <span className="w-12" aria-hidden />
          </div>
          {channel === 'WhatsApp' && <WhatsApp text={typed} offer={offer} />}
          {channel === 'SMS' && <Sms text={typed} />}
          {channel === 'Email' && <EmailView text={typed} subject={subject} offer={offer} />}
          {busy && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-card/85 backdrop-blur-sm" role="status">
              <AiOrb size="lg" state="composing" />
              <p className="ai-shimmer text-xs font-semibold">Rewriting for {channel}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

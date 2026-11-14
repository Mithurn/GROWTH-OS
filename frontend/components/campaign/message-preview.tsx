'use client';

import type { ReactNode } from 'react';
import {
  Archive,
  BatteryFull,
  Camera,
  Check,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Forward,
  Mail,
  Mic,
  MoreVertical,
  Phone,
  Plus,
  Reply,
  ShoppingBag,
  Signal,
  Smile,
  Star,
  Trash2,
  Video,
  Wifi,
} from 'lucide-react';
import { AiOrb } from '@/components/ui/ai-orb';
import { cn } from '@/lib/utils';
import { PHONE, PREVIEW, TIMING, type Channel } from './config';
import { useTypedText } from './hooks';

type MessagePreviewProps = {
  channel: Channel;
  message: string;
  subject: string;
  offer?: string | null;
  busy?: boolean;
  className?: string;
};

type ViewProps = { text: string; offer?: string | null };

const personalise = (text: string) => text.replace(/\{\{?\s*customer_name\s*\}?\}/gi, PREVIEW.customer);

function StatusBar({ className }: { className?: string }) {
  return (
    <div className={cn('flex h-12 shrink-0 items-end justify-between px-7 pb-1.5 text-label font-semibold tabular-nums', className)}>
      <span>{PREVIEW.time}</span>
      <span className="flex items-center gap-1" aria-hidden>
        <Signal className="size-3.5" strokeWidth={2.5} />
        <Wifi className="size-3.5" strokeWidth={2.5} />
        <BatteryFull className="size-[18px]" strokeWidth={2} />
      </span>
    </div>
  );
}

function Avatar({ className }: { className?: string }) {
  return (
    <span className={cn('flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#6B5CFF] to-primary-hover font-semibold text-white', className)}>
      {PREVIEW.brand[0]}
    </span>
  );
}

function OfferCard({ offer, className }: { offer?: string | null; className?: string }) {
  return (
    <div className={cn('overflow-hidden rounded-xl border border-black/5 bg-[#F6F7F9]', className)}>
      <div className="flex h-[88px] items-center justify-center bg-gradient-to-br from-[#E0E7FF] via-brand-tint to-[#DDD6FE]">
        <span className="flex size-11 items-center justify-center rounded-full bg-white/80 text-primary shadow-sm">
          <ShoppingBag className="size-5" aria-hidden />
        </span>
      </div>
      <div className="px-3 py-2">
        <p className="truncate text-label font-semibold text-foreground">{offer || 'Exclusive offer'}</p>
        <p className="text-2xs text-muted-foreground">{PREVIEW.link}</p>
      </div>
    </div>
  );
}

function WhatsApp({ text, offer }: ViewProps) {
  return (
    <>
      <div className="shrink-0 bg-[#008069] text-white">
        <StatusBar />
        <div className="flex items-center gap-2 px-2 pb-2.5">
          <ChevronLeft className="size-6" aria-hidden />
          <Avatar className="size-9 text-sm" />
          <div className="min-w-0 flex-1 leading-tight">
            <p className="flex items-center gap-1 truncate text-sm font-semibold">
              {PREVIEW.brand}
              <span className="flex size-3.5 items-center justify-center rounded-full bg-[#25D366]">
                <Check className="size-2.5 text-white" strokeWidth={3.5} aria-hidden />
              </span>
            </p>
            <p className="text-2xs text-white/80">Business account</p>
          </div>
          <Video className="size-5" aria-hidden />
          <Phone className="mx-1 size-[18px]" aria-hidden />
          <MoreVertical className="size-5" aria-hidden />
        </div>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden bg-[#EFE7DE] bg-[radial-gradient(rgba(0,0,0,0.05)_1px,transparent_1px)] p-3 [background-size:14px_14px]">
        <span className="mx-auto rounded-lg bg-white/90 px-2.5 py-1 text-2xs font-medium text-[#54656F] shadow-sm">Today</span>
        <p className="mx-auto max-w-[88%] rounded-lg bg-[#FFF5C4] px-2.5 py-1.5 text-center text-2xs leading-snug text-[#54656F]">
          This business uses a secure service from Meta to manage this chat.
        </p>
        <div className="max-w-[88%] self-start">
          <div className="rounded-xl rounded-tl-sm bg-white p-1.5 shadow-[0_1px_0.5px_rgba(11,20,26,0.13)]">
            <OfferCard offer={offer} className="rounded-lg" />
            <p className="whitespace-pre-wrap px-1.5 pt-2 text-sm leading-[1.4] text-[#111B21]">{text}</p>
            <p className="px-1.5 pt-1 text-2xs text-[#667781]">{PREVIEW.optOut}</p>
            <p className="flex items-center justify-end gap-1 px-1.5 pb-0.5 text-2xs text-[#667781]">
              {PREVIEW.time}
              <CheckCheck className="size-3.5 text-[#53BDEB]" aria-hidden />
            </p>
          </div>
          <span className="mt-0.5 flex items-center justify-center gap-1.5 rounded-xl bg-white py-2 text-sm font-medium text-[#027EB5] shadow-[0_1px_0.5px_rgba(11,20,26,0.13)]">
            <ExternalLink className="size-4" aria-hidden /> {PREVIEW.cta}
          </span>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2 bg-[#EFE7DE] px-2 pb-6 pt-1.5">
        <span className="flex h-10 flex-1 items-center gap-2 rounded-full bg-white px-3 text-[#667781]">
          <Smile className="size-5" aria-hidden />
          <span className="flex-1 text-sm">Message</span>
          <Camera className="size-5" aria-hidden />
        </span>
        <span className="flex size-10 items-center justify-center rounded-full bg-[#00A884] text-white">
          <Mic className="size-5" aria-hidden />
        </span>
      </div>
    </>
  );
}

function Sms({ text }: { text: string }) {
  const over = text.length > PREVIEW.smsLimit;
  return (
    <>
      <div className="shrink-0 border-b border-black/10 bg-[#F7F7F7]">
        <StatusBar className="text-black" />
        <div className="flex items-center px-2 pb-2">
          <span className="flex w-16 items-center text-[#007AFF]">
            <ChevronLeft className="size-7" aria-hidden />
          </span>
          <span className="flex flex-1 flex-col items-center gap-0.5">
            <span className="flex size-10 items-center justify-center rounded-full bg-gradient-to-b from-[#A5ABB8] to-[#7D8391] text-base font-semibold text-white">
              {PREVIEW.brand[0]}
            </span>
            <span className="flex items-center text-2xs text-black">
              {PREVIEW.smsSender}
              <ChevronRight className="size-3 text-[#8E8E93]" aria-hidden />
            </span>
          </span>
          <span className="w-16" aria-hidden />
        </div>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-hidden bg-white p-3">
        <p className="mb-1 text-center text-2xs text-[#8E8E93]">
          <span className="font-semibold">Text Message</span>
          <br />
          Today {PREVIEW.time}
        </p>
        <div className="relative max-w-[78%] self-start rounded-[18px] bg-[#E9E9EB] px-3.5 py-2">
          <p className="whitespace-pre-wrap text-sm leading-[1.3] text-black">{text}</p>
        </div>
        <p className={cn('mt-1 text-2xs tabular-nums', over ? 'font-medium text-amber-600' : 'text-[#8E8E93]')}>
          {text.length}/{PREVIEW.smsLimit} characters{over && ', sends as multiple parts'}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2 bg-white px-3 pb-6 pt-2">
        <span className="flex size-8 items-center justify-center rounded-full bg-[#F2F2F7] text-[#8E8E93]">
          <Plus className="size-5" aria-hidden />
        </span>
        <span className="flex h-9 flex-1 items-center justify-between rounded-full border border-black/15 px-3.5 text-sm text-[#C7C7CC]">
          Text Message
          <Mic className="size-4 text-[#8E8E93]" aria-hidden />
        </span>
      </div>
    </>
  );
}

function EmailView({ text, subject, offer }: ViewProps & { subject: string }) {
  return (
    <>
      <div className="shrink-0 bg-white text-[#444746]">
        <StatusBar className="text-black" />
        <div className="flex items-center gap-4 px-4 pb-2.5">
          <ChevronLeft className="size-6" aria-hidden />
          <span className="flex-1" />
          <Archive className="size-5" aria-hidden />
          <Trash2 className="size-5" aria-hidden />
          <Mail className="size-5" aria-hidden />
          <MoreVertical className="size-5" aria-hidden />
        </div>
      </div>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-white px-4 pt-1">
        <div className="flex items-start gap-2">
          <p className="flex-1 text-xl font-normal leading-tight text-[#1F1F1F]">{subject || 'Your offer'}</p>
          <Star className="mt-1 size-5 shrink-0 text-[#747775]" aria-hidden />
        </div>
        <span className="mt-2 w-fit rounded bg-[#E8EAED] px-1.5 py-0.5 text-2xs font-medium text-[#444746]">Inbox</span>
        <div className="mt-4 flex items-center gap-3">
          <Avatar className="size-10 text-base" />
          <div className="min-w-0 flex-1 leading-tight">
            <p className="flex items-baseline gap-2 text-sm font-semibold text-[#1F1F1F]">
              {PREVIEW.brand}
              <span className="text-2xs font-normal text-[#747775]">{PREVIEW.time}</span>
            </p>
            <p className="text-xs text-[#747775]">to me</p>
          </div>
          <Reply className="size-4 text-[#747775]" aria-hidden />
        </div>
        <div className="mt-4 min-h-0 flex-1 overflow-hidden">
          <p className="whitespace-pre-wrap text-sm leading-[1.5] text-[#1F1F1F]">{text}</p>
          <OfferCard offer={offer} className="mt-3" />
          <span className="mt-3 inline-block rounded-full bg-primary px-5 py-2.5 text-label font-semibold text-white">{PREVIEW.cta}</span>
          <p className="mt-4 text-2xs text-[#747775]">You are receiving this because you shop with {PREVIEW.brand}. Unsubscribe</p>
        </div>
      </div>
      <div className="flex shrink-0 gap-2 bg-white px-4 pb-6 pt-2">
        {[
          { icon: Reply, label: 'Reply' },
          { icon: Forward, label: 'Forward' },
        ].map(({ icon: Icon, label }) => (
          <span key={label} className="flex h-10 flex-1 items-center justify-center gap-2 rounded-full border border-[#C4C7C5] text-label font-medium text-[#444746]">
            <Icon className="size-4" aria-hidden /> {label}
          </span>
        ))}
      </div>
    </>
  );
}

function SideButton({ className }: { className: string }) {
  return <span aria-hidden className={cn('absolute w-[3px] rounded-sm bg-[#2A2D35]', className)} />;
}

function Device({ children }: { children: ReactNode }) {
  return (
    <div className="relative mx-auto w-full" style={{ maxWidth: PHONE.maxWidth }}>
      <SideButton className="-left-[3px] top-[104px] h-7 rounded-l" />
      <SideButton className="-left-[3px] top-[160px] h-12 rounded-l" />
      <SideButton className="-left-[3px] top-[224px] h-12 rounded-l" />
      <SideButton className="-right-[3px] top-[176px] h-16 rounded-r" />
      <div className="rounded-[3.2rem] bg-gradient-to-b from-[#4A4D57] via-[#23252C] to-[#3A3D46] p-[2.5px] shadow-[0_50px_80px_-32px_rgba(20,25,41,0.45),0_18px_30px_-18px_rgba(20,25,41,0.35)]">
        <div className="rounded-[3.1rem] bg-[#07080B] p-[11px]">
          <div className="relative flex flex-col overflow-hidden rounded-[2.5rem] bg-white" style={{ aspectRatio: PHONE.screenAspect }}>
            <span aria-hidden className="absolute left-1/2 top-2.5 z-20 h-[26px] w-[92px] -translate-x-1/2 rounded-full bg-black" />
            {children}
            <span aria-hidden className="absolute bottom-2 left-1/2 z-20 h-1 w-28 -translate-x-1/2 rounded-full bg-black/80" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function MessagePreview({ channel, message, subject, offer, busy, className }: MessagePreviewProps) {
  const typed = useTypedText(personalise(message), TIMING.typeTickMs, TIMING.typeCharsPerTick);

  return (
    <div className={cn('w-full', className)} aria-label={`${channel} preview`}>
      <Device>
        {channel === 'WhatsApp' && <WhatsApp text={typed} offer={offer} />}
        {channel === 'SMS' && <Sms text={typed} />}
        {channel === 'Email' && <EmailView text={typed} subject={subject} offer={offer} />}
        {busy && (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 bg-white/85 backdrop-blur-sm" role="status">
            <AiOrb size="lg" state="composing" />
            <p className="ai-shimmer text-sm font-semibold">Rewriting for {channel}</p>
          </div>
        )}
      </Device>
    </div>
  );
}

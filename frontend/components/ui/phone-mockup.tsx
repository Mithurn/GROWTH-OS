'use client';

import { Loader2 } from 'lucide-react';

interface PhoneMockupProps {
  channel: 'WhatsApp' | 'Email' | 'SMS';
  message: string;
  brandName?: string;
  isRefining?: boolean;
}

export function PhoneMockup({ channel, message, brandName = 'Xeno Brand', isRefining }: PhoneMockupProps) {
  const preview = message.replace(/\{\{customer_name\}\}/gi, 'Priya').replace(/\{customer_name\}/gi, 'Priya');

  return (
    <div className="relative mx-auto select-none" style={{ width: 260 }}>
      {/* Side buttons */}
      <div className="absolute -left-[12px] top-20 h-7 w-[5px] rounded-l bg-gray-600" />
      <div className="absolute -left-[12px] top-32 h-10 w-[5px] rounded-l bg-gray-600" />
      <div className="absolute -left-[12px] top-44 h-10 w-[5px] rounded-l bg-gray-600" />
      <div className="absolute -right-[12px] top-28 h-14 w-[5px] rounded-r bg-gray-600" />

      {/* Phone shell */}
      <div className="rounded-[2.5rem] border-[9px] border-gray-800 bg-gray-800 shadow-2xl ring-1 ring-black/30">
        {/* Notch */}
        <div className="absolute inset-x-0 top-0 flex justify-center z-10">
          <div className="h-5 w-20 rounded-b-2xl bg-gray-800" />
        </div>

        {/* Screen */}
        <div className="overflow-hidden rounded-[1.9rem] bg-white" style={{ height: 540 }}>
          {isRefining ? (
            <RefiningOverlay channel={channel} />
          ) : channel === 'WhatsApp' ? (
            <WhatsAppView message={preview} brandName={brandName} />
          ) : channel === 'Email' ? (
            <EmailView message={preview} brandName={brandName} />
          ) : (
            <SmsView message={preview} brandName={brandName} />
          )}
        </div>
      </div>

      {/* Home indicator */}
      <div className="mx-auto mt-2 h-[3px] w-16 rounded-full bg-gray-600" />
    </div>
  );
}

function RefiningOverlay({ channel }: { channel: string }) {
  const bg = channel === 'WhatsApp' ? 'bg-[#ECE5DD]' : 'bg-gray-50';
  return (
    <div className={`flex h-full flex-col items-center justify-center gap-3 ${bg}`}>
      <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
      <p className="text-xs text-gray-500 font-medium">Rewriting for {channel}…</p>
    </div>
  );
}

function WhatsAppView({ message, brandName }: { message: string; brandName: string }) {
  const now = new Date();
  const time = `${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`;
  const initial = brandName.charAt(0).toUpperCase();

  return (
    <div className="flex h-full flex-col" style={{ background: '#ECE5DD' }}>
      {/* Status bar */}
      <div className="flex items-center justify-between px-4 pt-6 pb-1" style={{ background: '#075E54' }}>
        <span className="text-[9px] font-bold text-white">9:41</span>
        <div className="flex items-center gap-1">
          <div className="h-1.5 w-3 rounded-sm bg-white/80" />
          <div className="h-1.5 w-1.5 rounded-full bg-white/80" />
          <div className="h-1.5 w-4 rounded-sm border border-white/60 bg-white/80" />
        </div>
      </div>

      {/* Header */}
      <div className="flex items-center gap-2.5 px-3 pb-2.5" style={{ background: '#075E54' }}>
        <span className="text-xs text-white/80">←</span>
        <div className="h-7 w-7 rounded-full bg-emerald-400 flex items-center justify-center text-[10px] font-bold text-emerald-900 shrink-0">
          {initial}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[11px] font-semibold text-white truncate">{brandName}</div>
          <div className="text-[8px] text-emerald-200">Online</div>
        </div>
        <div className="flex gap-3 text-white/70 text-[11px]">
          <span>📹</span><span>📞</span><span>⋮</span>
        </div>
      </div>

      {/* Chat area */}
      <div className="flex-1 overflow-hidden px-2 py-3 flex items-end">
        <div className="w-full space-y-1">
          <div className="max-w-[88%] ml-auto">
            <div
              className="rounded-lg rounded-tr-none px-3 py-2 shadow-sm text-[10px] leading-relaxed text-gray-800 whitespace-pre-wrap"
              style={{ background: '#DCF8C6' }}
            >
              {message}
            </div>
            <div className="flex items-center justify-end gap-0.5 mt-0.5">
              <span className="text-[8px] text-gray-400">{time}</span>
              <span className="text-[9px] text-blue-500">✓✓</span>
            </div>
          </div>
        </div>
      </div>

      {/* Input bar */}
      <div className="flex items-center gap-1.5 px-2 py-2 bg-[#F0F0F0]">
        <div className="flex-1 rounded-full bg-white px-3 py-1.5 flex items-center">
          <span className="text-[9px] text-gray-400">Type a message</span>
        </div>
        <div className="h-6 w-6 rounded-full flex items-center justify-center text-white text-[9px]" style={{ background: '#25D366' }}>
          🎤
        </div>
      </div>
    </div>
  );
}

function EmailView({ message, brandName }: { message: string; brandName: string }) {
  return (
    <div className="flex h-full flex-col bg-white">
      {/* Status bar */}
      <div className="flex items-center justify-between bg-gray-100 px-4 pt-6 pb-1">
        <span className="text-[9px] font-bold text-gray-800">9:41</span>
        <div className="flex items-center gap-1">
          <div className="h-1.5 w-3 rounded-sm bg-gray-500" />
          <div className="h-1.5 w-1.5 rounded-full bg-gray-500" />
          <div className="h-1.5 w-4 rounded-sm border border-gray-400 bg-gray-400" />
        </div>
      </div>

      {/* Email app header */}
      <div className="bg-gray-100 border-b border-gray-200 px-3 py-2">
        <div className="text-[9px] font-bold text-gray-500 uppercase tracking-wide mb-1">Inbox</div>
        <div className="text-[11px] font-semibold text-gray-900">{brandName}</div>
        <div className="text-[9px] text-gray-500 mt-0.5 truncate">Exclusive offer just for you 🎁</div>
      </div>

      {/* Email divider */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100">
        <div className="h-5 w-5 rounded-full bg-indigo-100 flex items-center justify-center text-[8px] font-bold text-indigo-600 shrink-0">
          {brandName.charAt(0)}
        </div>
        <div className="min-w-0">
          <div className="text-[9px] font-semibold text-gray-800">{brandName}</div>
          <div className="text-[8px] text-gray-400">to me</div>
        </div>
      </div>

      {/* Email body */}
      <div className="flex-1 overflow-hidden px-3 py-3">
        <p className="text-[10px] leading-relaxed text-gray-700 whitespace-pre-wrap">{message}</p>
      </div>
    </div>
  );
}

function SmsView({ message, brandName }: { message: string; brandName: string }) {
  const now = new Date();
  const time = `${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')} ${now.getHours() >= 12 ? 'PM' : 'AM'}`;

  return (
    <div className="flex h-full flex-col bg-white">
      {/* Status bar */}
      <div className="flex items-center justify-between bg-white px-4 pt-6 pb-1">
        <span className="text-[9px] font-bold text-gray-900">9:41</span>
        <div className="flex items-center gap-1">
          <div className="text-[9px] text-gray-700">●●●</div>
          <div className="h-1.5 w-4 rounded-sm border border-gray-700 bg-gray-700" />
        </div>
      </div>

      {/* SMS contact header */}
      <div className="border-b border-gray-100 px-3 pb-2 text-center">
        <div className="h-9 w-9 rounded-full bg-gray-200 flex items-center justify-center mx-auto mb-1">
          <span className="text-sm font-bold text-gray-500">{brandName.charAt(0)}</span>
        </div>
        <div className="text-[10px] font-semibold text-gray-900">{brandName}</div>
        <div className="text-[8px] text-gray-400">Business SMS</div>
      </div>

      {/* SMS bubble */}
      <div className="flex-1 overflow-hidden px-3 py-3">
        <div className="text-[8px] text-gray-400 text-center mb-2">{time}</div>
        <div className="max-w-[88%] ml-auto">
          <div className="rounded-2xl rounded-br-sm bg-[#007AFF] px-3 py-2">
            <p className="text-[10px] leading-relaxed text-white whitespace-pre-wrap">{message}</p>
          </div>
          <div className="text-[8px] text-gray-400 text-right mt-0.5">Delivered</div>
        </div>
      </div>

      {/* SMS input */}
      <div className="flex items-center gap-1.5 border-t border-gray-200 px-2 py-2">
        <div className="flex-1 rounded-full border border-gray-300 bg-white px-3 py-1">
          <span className="text-[9px] text-gray-400">iMessage</span>
        </div>
        <div className="h-5 w-5 rounded-full bg-[#007AFF] flex items-center justify-center text-white text-[8px]">↑</div>
      </div>
    </div>
  );
}

'use client';

import { useRef, useState } from 'react';
import { Play, X } from 'lucide-react';

const WATCH_VIDEO = {
  label: 'Watch the 28 second demo',
  title: 'GrowthOS launch video',
  src: '/video/growthos-launch.mp4',
  poster: '/video/growthos-launch-poster.jpg',
  captions: { src: '/video/growthos-launch.vtt', label: 'English', lang: 'en' },
  note: 'Sample data from the demo. Captions included.',
} as const;

const TRIGGER =
  'inline-flex cursor-pointer items-center gap-2.5 rounded-full px-4 py-2 text-sm font-medium text-zinc-300 transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-indigo-400';

export function WatchVideoButton() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);

  const show = () => {
    setOpen(true);
    dialogRef.current?.showModal();
  };
  const close = () => dialogRef.current?.close();

  return (
    <>
      <button type="button" onClick={show} className={TRIGGER}>
        <span className="flex size-8 items-center justify-center rounded-full border border-white/15 bg-white/[0.06]">
          <Play className="size-3.5 translate-x-px fill-current" aria-hidden />
        </span>
        {WATCH_VIDEO.label}
      </button>
      <dialog
        ref={dialogRef}
        aria-label={WATCH_VIDEO.title}
        onClose={() => setOpen(false)}
        onClick={(e) => e.target === dialogRef.current && close()}
        className="m-auto w-[min(92vw,64rem)] max-w-none overflow-visible bg-transparent p-0 backdrop:bg-black/80 backdrop:backdrop-blur-sm"
      >
        <button
          type="button"
          onClick={close}
          aria-label="Close video"
          className="absolute -top-12 right-0 flex size-9 cursor-pointer items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-indigo-400"
        >
          <X className="size-4" aria-hidden />
        </button>
        {open && (
          <video
            controls
            autoPlay
            playsInline
            poster={WATCH_VIDEO.poster}
            aria-label={WATCH_VIDEO.title}
            className="aspect-video w-full rounded-2xl border border-white/10 bg-[#0d0d14] shadow-[0_40px_120px_-40px_rgba(91,79,255,0.5)]"
          >
            <source src={WATCH_VIDEO.src} type="video/mp4" />
            <track kind="captions" src={WATCH_VIDEO.captions.src} srcLang={WATCH_VIDEO.captions.lang} label={WATCH_VIDEO.captions.label} default />
          </video>
        )}
        <p className="mt-3 text-center text-xs text-zinc-400">{WATCH_VIDEO.note}</p>
      </dialog>
    </>
  );
}

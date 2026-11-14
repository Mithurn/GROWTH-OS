import { Reveal } from './reveal';

const LAUNCH_VIDEO = {
  id: 'watch',
  eyebrow: 'Watch it work',
  title: '28 seconds from quiet customers to a sent campaign.',
  note: 'Sample data from the live demo. Sound on for the voiceover, captions included.',
  label: 'GrowthOS launch video',
  src: '/video/growthos-launch.mp4',
  poster: '/video/growthos-launch-poster.jpg',
  captions: { src: '/video/growthos-launch.vtt', label: 'English', lang: 'en' },
  width: 1920,
  height: 1080,
} as const;

export function LaunchVideo() {
  const { captions } = LAUNCH_VIDEO;
  return (
    <section id={LAUNCH_VIDEO.id} className="mx-auto max-w-6xl scroll-mt-20 px-6 pb-8 pt-24">
      <Reveal>
        <p className="text-sm font-medium text-indigo-300">{LAUNCH_VIDEO.eyebrow}</p>
        <h2 className="mt-3 max-w-2xl text-4xl font-semibold tracking-tight text-white sm:text-5xl">{LAUNCH_VIDEO.title}</h2>
      </Reveal>
      <Reveal className="mt-10">
        <video
          controls
          playsInline
          preload="none"
          poster={LAUNCH_VIDEO.poster}
          width={LAUNCH_VIDEO.width}
          height={LAUNCH_VIDEO.height}
          aria-label={LAUNCH_VIDEO.label}
          className="aspect-video h-auto w-full rounded-2xl border border-white/10 bg-[#0d0d14] shadow-[0_40px_120px_-40px_rgba(91,79,255,0.5)]"
        >
          <source src={LAUNCH_VIDEO.src} type="video/mp4" />
          <track kind="captions" src={captions.src} srcLang={captions.lang} label={captions.label} default />
        </video>
        <p className="mt-4 text-xs text-zinc-500">{LAUNCH_VIDEO.note}</p>
      </Reveal>
    </section>
  );
}

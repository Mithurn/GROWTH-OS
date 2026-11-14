import Image from 'next/image';

export function BrowserFrame({ src, alt, priority = false }: { src: string; alt: string; priority?: boolean }) {
  return (
    <figure className="overflow-hidden rounded-xl border border-white/10 bg-[#0d0d14]">
      <div className="flex items-center gap-1.5 border-b border-white/[0.07] px-4 py-2.5" aria-hidden>
        <span className="size-2 rounded-full bg-white/15" />
        <span className="size-2 rounded-full bg-white/15" />
        <span className="size-2 rounded-full bg-white/15" />
      </div>
      <Image src={src} alt={alt} width={1440} height={860} priority={priority} className="h-auto w-full" />
    </figure>
  );
}

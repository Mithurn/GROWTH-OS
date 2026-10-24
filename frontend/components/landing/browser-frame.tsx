import Image from 'next/image';

export function BrowserFrame({ src, alt, priority = false }: { src: string; alt: string; priority?: boolean }) {
  return (
    <figure className="overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white shadow-[0_24px_60px_-20px_rgba(17,24,39,0.25)]">
      <div className="flex items-center gap-1.5 border-b border-[#E5E7EB] bg-[#F9FAFB] px-4 py-3" aria-hidden>
        <span className="h-2.5 w-2.5 rounded-full bg-[#E5E7EB]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#E5E7EB]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#E5E7EB]" />
        <span className="ml-3 rounded-md bg-white px-3 py-0.5 text-[11px] text-[#9CA3AF]">growos-ai.vercel.app</span>
      </div>
      <Image src={src} alt={alt} width={1440} height={860} priority={priority} className="h-auto w-full" />
    </figure>
  );
}

'use client';

import { BorderBeam } from 'border-beam';
import { BrowserFrame } from './browser-frame';
import { Reveal } from './reveal';
import { BENTO } from './config';

export function ProductBento() {
  return (
    <section id="product" className="mx-auto max-w-6xl scroll-mt-20 px-6 pb-28">
      <Reveal>
        <p className="text-sm font-medium text-indigo-300">The product</p>
        <h2 className="mt-3 max-w-2xl text-4xl font-semibold tracking-tight text-white sm:text-5xl">
          Everything the agent does, in one workspace.
        </h2>
      </Reveal>
      <div className="mt-16 grid gap-4 lg:grid-cols-6">
        {BENTO.map((tile) => {
          const card = (
            <article className="flex h-full flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0b0b12] p-6">
              <p className="text-xs font-medium text-indigo-300">{tile.eyebrow}</p>
              <h3 className="mt-2 text-xl font-semibold tracking-tight text-white">{tile.title}</h3>
              <p className="mt-2 max-w-md text-sm leading-relaxed text-zinc-400">{tile.body}</p>
              <div className="mt-6 flex-1 [mask-image:linear-gradient(to_bottom,black_70%,transparent)]">
                <BrowserFrame src={tile.shot} alt={tile.alt} />
              </div>
            </article>
          );
          return (
            <Reveal key={tile.id} className={tile.span}>
              {tile.beam ? (
                <BorderBeam size="md" colorVariant="ocean" theme="dark" strength={0.6} duration={7}>
                  {card}
                </BorderBeam>
              ) : (
                card
              )}
            </Reveal>
          );
        })}
      </div>
    </section>
  );
}

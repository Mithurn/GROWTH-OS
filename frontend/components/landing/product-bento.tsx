'use client';

import type { ComponentType } from 'react';
import { BorderBeam } from 'border-beam';
import { Reveal } from './reveal';
import { BENTO } from './config';
import { CampaignVisual } from './visuals/campaign-visual';
import { FunnelVisual } from './visuals/funnel-visual';
import { OpportunityVisual } from './visuals/opportunity-visual';
import { PersonasVisual } from './visuals/personas-visual';

const VISUALS: Record<(typeof BENTO)[number]['id'], ComponentType> = {
  opportunities: OpportunityVisual,
  campaigns: CampaignVisual,
  analytics: FunnelVisual,
  personas: PersonasVisual,
};

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
          const Visual = VISUALS[tile.id];
          const card = (
            <article className="flex h-full flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0b0b12]">
              <div className="p-6 pb-5">
                <h3 className="text-xl font-semibold tracking-tight text-white">{tile.title}</h3>
                <p className="mt-2 max-w-md text-sm leading-relaxed text-zinc-400">{tile.body}</p>
              </div>
              <div className="flex-1 px-6 pt-1">
                <Visual />
              </div>
            </article>
          );
          return (
            <Reveal key={tile.id} className={`${tile.span} flex flex-col [&>*]:flex-1`}>
              {tile.beam ? (
                <BorderBeam size="md" colorVariant="ocean" theme="dark" strength={0.6} duration={7} className="flex h-full flex-col">
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

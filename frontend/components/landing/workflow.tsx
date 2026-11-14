import { AiOrb } from '@/components/ui/ai-orb';
import { Reveal } from './reveal';
import { STAGES } from './config';

export function Workflow() {
  return (
    <section id="workflow" className="mx-auto max-w-6xl scroll-mt-20 px-6 py-28">
      <Reveal>
        <p className="text-sm font-medium text-indigo-300">The agent loop</p>
        <h2 className="mt-3 max-w-2xl text-4xl font-semibold tracking-tight text-white sm:text-5xl">
          Observe, decide, draft, launch. You hold the last step.
        </h2>
      </Reveal>
      <ol className="mt-16 grid gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/10 sm:grid-cols-2 lg:grid-cols-4">
        {STAGES.map((stage, index) => (
          <li key={stage.id} className="group relative bg-[#08080d] p-7 transition-colors hover:bg-[#0d0d16]">
            <div className="flex items-center justify-between">
              <span className="font-(family-name:--font-jetbrains) text-xs text-zinc-500">0{index + 1}</span>
              <AiOrb size="lg" state={stage.orb} theme="dark" />
            </div>
            <h3 className="mt-10 text-xl font-semibold text-white">{stage.label}</h3>
            <p className="mt-2 text-sm leading-relaxed text-zinc-400">{stage.body}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

import { Reveal } from './reveal';
import { ARCHITECTURE, BOUNDARY } from './config';

export function Architecture() {
  return (
    <section id="architecture" className="mx-auto max-w-6xl scroll-mt-20 px-6 pb-28">
      <Reveal>
        <p className="text-sm font-medium text-indigo-300">Trust and control</p>
        <h2 className="mt-3 max-w-2xl text-4xl font-semibold tracking-tight text-white sm:text-5xl">
          You stay in control. The agent does the work.
        </h2>
        <p className="mt-4 max-w-2xl text-zinc-400">Every number comes from your own data. The AI only writes the words.</p>
      </Reveal>

      <Reveal className="mt-12">
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0b0b12]">
          <div className="grid grid-cols-2 border-b border-white/10 text-xs font-medium uppercase tracking-wider">
            <div className="p-4 text-indigo-300">Calculated from your data</div>
            <div className="border-l border-white/10 p-4 text-zinc-500">Written by the agent</div>
          </div>
          {BOUNDARY.map((row) => (
            <div key={row.code} className="grid grid-cols-2 border-b border-white/[0.06] text-sm last:border-b-0">
              <div className="p-4 text-zinc-200">{row.code}</div>
              <div className="border-l border-white/10 p-4 text-zinc-500">{row.model}</div>
            </div>
          ))}
        </div>
      </Reveal>

      <dl className="mt-16 grid gap-x-12 gap-y-10 sm:grid-cols-2">
        {ARCHITECTURE.map((item) => (
          <Reveal key={item.title}>
            <dt className="font-semibold text-white">{item.title}</dt>
            <dd className="mt-2 text-sm leading-relaxed text-zinc-400">{item.body}</dd>
          </Reveal>
        ))}
      </dl>

    </section>
  );
}

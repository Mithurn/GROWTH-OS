import { AiOrb } from '@/components/ui/ai-orb';
import { KPI_SKELETONS } from './config';

const block = 'animate-pulse rounded-2xl bg-[#F1F2F5] motion-reduce:animate-none';

export function AnalyticsSkeleton() {
  return (
    <div role="status" aria-label="Loading analytics" className="space-y-4">
      <div className="flex items-center gap-3">
        <AiOrb size="md" state="working" />
        <div className="space-y-2">
          <div className={`${block} h-6 w-56`} />
          <div className={`${block} h-4 w-40`} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {Array.from({ length: KPI_SKELETONS }, (_, i) => (
          <div key={i} className={`${block} h-28`} />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className={`${block} h-[380px] lg:col-span-2`} />
        <div className={`${block} h-[380px]`} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className={`${block} h-72`} />
        <div className={`${block} h-72`} />
      </div>
    </div>
  );
}

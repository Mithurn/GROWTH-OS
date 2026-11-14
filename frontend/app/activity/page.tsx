import { ActivityRunTrace } from '@/components/agent/activity-run-trace';
import { ActivityStream } from '@/components/agent/activity-stream';

export default function ActivityPage() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-8 sm:py-10">
      <h1 className="text-2xl font-semibold tracking-tight text-[#1A1A1A]">Activity</h1>
      <p className="mt-1 text-sm text-[#6B7280]">Everything the agent has found, drafted and sent, with its reasoning.</p>
      <div className="mt-6 grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
        <ActivityStream />
        <ActivityRunTrace className="lg:sticky lg:top-6" />
      </div>
    </div>
  );
}

import { PageHeader } from '@/components/agent/page-header';
import { ActivityRunTrace } from '@/components/agent/activity-run-trace';
import { ActivityStream } from '@/components/agent/activity-stream';
import { PAGE_SHELL_CLASS } from '@/components/ui/surface';

export default function ActivityPage() {
  return (
    <div className={PAGE_SHELL_CLASS}>
      <PageHeader title="Activity" description="Live feed of what the agent finds, drafts and sends. Open any item to watch its run." />
      <div className="mt-6 grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_400px]">
        <ActivityStream />
        <ActivityRunTrace title="Live run trace" className="lg:sticky lg:top-6" />
      </div>
    </div>
  );
}

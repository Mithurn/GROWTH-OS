import type { ReactNode } from 'react';
import { AgentAvatar } from './agent-avatar';
import type { AgentState } from './agent-config';

type PageHeaderProps = {
  title: string;
  description?: string;
  state?: AgentState;
  actions?: ReactNode;
};

export function PageHeader({ title, description, state = 'idle', actions }: PageHeaderProps) {
  return (
    <header className="flex flex-wrap items-center gap-4">
      <AgentAvatar state={state} size="md" />
      <div className="min-w-0 flex-1">
        <h1 className="text-2xl font-semibold tracking-tight text-[#1A1A1A]">{title}</h1>
        {description && <p className="text-sm text-[#6B7280]">{description}</p>}
      </div>
      {actions && <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">{actions}</div>}
    </header>
  );
}

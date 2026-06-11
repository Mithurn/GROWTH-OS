'use client';

import { Check } from 'lucide-react';

interface Step {
  id: number;
  name: string;
  status: 'completed' | 'current' | 'upcoming';
}

interface ProgressTrackerProps {
  steps: Step[];
}

export function ProgressTracker({ steps }: ProgressTrackerProps) {
  return (
    <div className="w-full py-8">
      <nav aria-label="Progress">
        <ol className="flex items-center justify-between">
          {steps.map((step, stepIdx) => (
            <li
              key={step.id}
              className={`relative ${
                stepIdx !== steps.length - 1 ? 'flex-1' : ''
              }`}
            >
              {stepIdx !== steps.length - 1 && (
                <div
                  className="absolute left-0 top-4 -ml-px h-0.5 w-full"
                  aria-hidden="true"
                >
                  <div
                    className={`h-0.5 ${
                      step.status === 'completed'
                        ? 'bg-primary'
                        : 'bg-gray-200'
                    }`}
                  />
                </div>
              )}
              <div className="group relative flex flex-col items-center">
                <span className="flex h-9 w-9 items-center justify-center rounded-full border-2 bg-white">
                  {step.status === 'completed' ? (
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary">
                      <Check className="h-5 w-5 text-white" />
                    </span>
                  ) : step.status === 'current' ? (
                    <span className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-primary bg-white">
                      <span className="h-2.5 w-2.5 rounded-full bg-primary" />
                    </span>
                  ) : (
                    <span className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-gray-300 bg-white">
                      <span className="h-2.5 w-2.5 rounded-full bg-transparent" />
                    </span>
                  )}
                </span>
                <span
                  className={`mt-2 text-sm font-medium ${
                    step.status === 'current'
                      ? 'text-primary'
                      : step.status === 'completed'
                      ? 'text-gray-900'
                      : 'text-gray-500'
                  }`}
                >
                  {step.name}
                </span>
              </div>
            </li>
          ))}
        </ol>
      </nav>
    </div>
  );
}

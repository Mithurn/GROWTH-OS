'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';

interface ProcessingStep {
  id: string;
  label: string;
  completed: boolean;
}

interface ProcessingProps {
  onComplete: () => void;
}

export function Step5Processing({ onComplete }: ProcessingProps) {
  const [steps, setSteps] = useState<ProcessingStep[]>([
    { id: 'validate', label: 'Data Validated', completed: false },
    { id: 'customers', label: 'Customers Imported', completed: false },
    { id: 'orders', label: 'Orders Imported', completed: false },
    { id: 'metrics', label: 'Customer Metrics Generated', completed: false },
    { id: 'opportunities', label: 'Opportunity Engine Ready', completed: false },
  ]);

  useEffect(() => {
    // Simulate processing steps
    const delays = [1000, 2000, 2500, 3500, 4000];

    delays.forEach((delay, index) => {
      setTimeout(() => {
        setSteps(prev => prev.map((step, i) =>
          i === index ? { ...step, completed: true } : step
        ));

        // Call onComplete when last step finishes
        if (index === delays.length - 1) {
          setTimeout(onComplete, 500);
        }
      }, delay);
    });
  }, [onComplete]);

  const allCompleted = steps.every(step => step.completed);

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Processing Your Data</CardTitle>
        <CardDescription>
          {allCompleted
            ? 'All done! Preparing your customer intelligence...'
            : 'Please wait while we process your data...'
          }
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {steps.map((step) => (
            <div
              key={step.id}
              className={`flex items-center space-x-3 p-4 rounded-lg transition-all ${
                step.completed
                  ? 'bg-green-50 border border-green-200'
                  : 'bg-gray-50 border border-gray-200'
              }`}
            >
              {step.completed ? (
                <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
              ) : (
                <Loader2 className="h-5 w-5 text-gray-400 flex-shrink-0 animate-spin" />
              )}
              <span
                className={`text-sm font-medium ${
                  step.completed ? 'text-green-900' : 'text-gray-600'
                }`}
              >
                {step.label}
              </span>
            </div>
          ))}
        </div>

        {allCompleted && (
          <div className="mt-6 p-4 bg-primary/10 border border-primary/20 rounded-lg text-center">
            <p className="text-sm font-medium text-primary">
              🎉 Processing complete! Redirecting to growth opportunities...
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

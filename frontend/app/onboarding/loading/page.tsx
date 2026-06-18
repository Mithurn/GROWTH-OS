'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Sparkles } from 'lucide-react';

const LOADING_STEPS = [
  { key: 'validating', label: 'Validating data' },
  { key: 'parsing', label: 'Parsing CSV files' },
  { key: 'importing_customers', label: 'Importing customers' },
  { key: 'importing_orders', label: 'Importing orders' },
  { key: 'calculating_metrics', label: 'Calculating metrics' },
  { key: 'generating_personas', label: 'Generating personas' },
];

export default function LoadingPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const [message, setMessage] = useState('Starting...');
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const sessionId = window.localStorage.getItem('growthOS_session_id');

    if (!sessionId) {
      // No session - use fallback auto-progress
      const interval = setInterval(() => {
        setCurrentStep((prev) => {
          if (prev < LOADING_STEPS.length - 1) {
            return prev + 1;
          }
          clearInterval(interval);
          setTimeout(() => {
            window.localStorage.removeItem('growthOS_onboarding');
            window.localStorage.removeItem('growthOS_session_id');
            router.push('/opportunities');
          }, 1500);
          return prev;
        });
      }, 1500);
      return () => clearInterval(interval);
    }

    // Poll for ingestion status
    const interval = setInterval(async () => {
      try {
        const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'https://xeno-crm-backend-n6d8.onrender.com/api';
        const response = await fetch(`${API_BASE}/ingestion-status/${sessionId}`);
        if (!response.ok) return;

        const status = await response.json();
        setMessage(status.message || 'Processing...');
        setProgress(status.progress || 0);

        // Map status step to current step index
        const stepIndex = LOADING_STEPS.findIndex(s => status.step?.includes(s.key));
        if (stepIndex >= 0) {
          setCurrentStep(stepIndex);
        }

        if (status.step === 'completed') {
          clearInterval(interval);
          setCurrentStep(LOADING_STEPS.length);
          setTimeout(() => {
            window.localStorage.removeItem('growthOS_onboarding');
            window.localStorage.removeItem('growthOS_session_id');
            router.push('/opportunities');
          }, 1500);
        }

        if (status.step === 'error') {
          clearInterval(interval);
          setMessage(status.message || 'An error occurred');
        }
      } catch (err) {
        console.error('Failed to check status:', err);
      }
    }, 500);

    return () => clearInterval(interval);
  }, [router]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-white">
      <div className="w-full max-w-sm px-4 text-center">
        {/* Animated Icon */}
        <div className="mx-auto mb-6 flex h-12 w-12 items-center justify-center rounded-xl bg-[#5B4FFF]">
          <Sparkles className="h-6 w-6 text-white animate-pulse" />
        </div>

        {/* Title */}
        <h1 className="text-xl font-semibold text-[#1A1A1A]">
          Building your growth engine
        </h1>
        <p className="mt-1 text-sm text-[#6B7280]">
          {message}
        </p>

        {/* Progress bar */}
        <div className="mt-4 h-1 w-full bg-[#E5E7EB] rounded-full overflow-hidden">
          <div
            className="h-full bg-[#5B4FFF] transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Progress Steps */}
        <div className="mt-6 space-y-2 text-left">
          {LOADING_STEPS.map((step, index) => {
            const isComplete = index < currentStep;
            const isCurrent = index === currentStep;

            return (
              <div
                key={step.key}
                className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 transition-all ${
                  isComplete
                    ? 'border-emerald-200 bg-emerald-50'
                    : isCurrent
                    ? 'border-[#5B4FFF] bg-[#F8F7FF]'
                    : 'border-[#E5E7EB] bg-white opacity-50'
                }`}
              >
                <div
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full transition-all ${
                    isComplete
                      ? 'bg-emerald-500'
                      : isCurrent
                      ? 'bg-[#5B4FFF]'
                      : 'bg-[#E5E7EB]'
                  }`}
                >
                  {isComplete ? (
                    <Check className="h-3 w-3 text-white" strokeWidth={3} />
                  ) : isCurrent ? (
                    <div className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
                  ) : (
                    <div className="h-1 w-1 rounded-full bg-[#9CA3AF]" />
                  )}
                </div>
                <span
                  className={`text-sm font-medium transition-colors ${
                    isComplete
                      ? 'text-emerald-700'
                      : isCurrent
                      ? 'text-[#5B4FFF]'
                      : 'text-[#9CA3AF]'
                  }`}
                >
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
}

'use client';

import { useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Loader2, ShieldCheck, UploadCloud, Zap } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { AiOrb } from '@/components/ui/ai-orb';
import { PrimaryAction } from '@/components/agent/primary-action';
import { cn } from '@/lib/utils';
import {
  saveBusinessInfo,
  uploadCustomerCSV,
  uploadOrderCSV,
  startIngestion,
  seedDemoData,
  getIngestionStatus,
  saveOnboardingProfile,
  createAgent,
  generateOpportunities,
} from '@/lib/api';
import {
  AGENT_CHANNELS,
  AGENT_FREQUENCY_CAP,
  AGENT_LINES,
  AGENT_MAX_BUDGET,
  DEMO_CUSTOMERS,
  DEMO_ORDERS,
  FORM_STEPS,
  GOALS,
  GOAL_LABELS,
  INDUSTRIES,
  MAX_POLLS,
  POLL_INTERVAL_MS,
  SETUP_ITEMS,
  STEP_ORDER,
  getDoneCount,
  type Step,
} from './onboarding-config';
import { OnboardingShell } from './onboarding-shell';

const primaryButton =
  'flex w-full items-center justify-center gap-2 rounded-xl bg-[#5B4FFF] py-3 text-sm font-medium text-white transition-colors hover:bg-[#4B3FE5] disabled:cursor-not-allowed disabled:opacity-40';

function Choice({
  selected,
  onClick,
  icon: Icon,
  label,
  hint,
}: {
  selected: boolean;
  onClick: () => void;
  icon: LucideIcon;
  label: string;
  hint?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        'flex items-center gap-3 rounded-xl border p-4 text-left transition-colors',
        selected ? 'border-[#5B4FFF] bg-[#F8F7FF]' : 'border-[#E5E7EB] bg-white hover:border-[#C7D2FE]',
      )}
    >
      <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-lg', selected ? 'bg-[#EEF2FF] text-[#5B4FFF]' : 'bg-[#F3F4F6] text-[#6B7280]')}>
        <Icon className="size-4" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-[#1A1A1A]">{label}</span>
        {hint && <span className="block text-xs text-[#9CA3AF]">{hint}</span>}
      </span>
      {selected && <Check className="size-4 text-[#5B4FFF]" aria-hidden />}
    </button>
  );
}

function FileDrop({ file, label, hint, onPick }: { file: File | null; label: string; hint: string; onPick: (file: File | null) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <input ref={ref} type="file" accept=".csv" className="hidden" onChange={(e) => onPick(e.target.files?.[0] ?? null)} />
      <button
        type="button"
        onClick={() => ref.current?.click()}
        className={cn(
          'flex w-full items-center gap-4 rounded-xl border border-dashed p-4 text-left transition-colors hover:border-[#5B4FFF] hover:bg-[#F8F7FF]',
          file ? 'border-[#5B4FFF] bg-[#F8F7FF]' : 'border-[#D1D5DB]',
        )}
      >
        <span className={cn('flex size-10 shrink-0 items-center justify-center rounded-lg', file ? 'bg-[#EEF2FF] text-[#5B4FFF]' : 'bg-[#F3F4F6] text-[#9CA3AF]')}>
          {file ? <Check className="size-5" aria-hidden /> : <UploadCloud className="size-5" aria-hidden />}
        </span>
        <span>
          <span className="block text-sm font-medium text-[#1A1A1A]">{label}</span>
          <span className="block text-xs text-[#9CA3AF]">{file ? file.name : hint}</span>
        </span>
      </button>
    </>
  );
}

export default function OnboardingPage() {
  const [step, setStep] = useState<Step>('welcome');
  const [companyName, setCompanyName] = useState('');
  const [industry, setIndustry] = useState('');
  const [creatingCompany, setCreatingCompany] = useState(false);
  const [companyError, setCompanyError] = useState('');
  const [customerFile, setCustomerFile] = useState<File | null>(null);
  const [orderFile, setOrderFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [useDemoData, setUseDemoData] = useState(false);
  const [goal, setGoal] = useState('');
  const [mode, setMode] = useState<'operator' | 'autonomous'>('operator');
  const [isSettingUp, setIsSettingUp] = useState(false);
  const [doneItems, setDoneItems] = useState<number[]>([]);
  const [ingestionMessage, setIngestionMessage] = useState('');
  const [setupError, setSetupError] = useState('');

  const move = (delta: number) => {
    const i = STEP_ORDER.indexOf(step) + delta;
    if (i >= 0 && i < STEP_ORDER.length) setStep(STEP_ORDER[i]);
  };
  const next = () => move(1);
  const back = () => move(-1);

  async function handleCompanyContinue() {
    if (!companyName.trim() || !industry) return;
    setCreatingCompany(true);
    setCompanyError('');
    try {
      const res = await saveBusinessInfo(companyName.trim(), industry);
      if (!res?.data?.id) throw new Error('No company ID returned');
      next();
    } catch {
      setCompanyError('Failed to save. Please try again.');
    } finally {
      setCreatingCompany(false);
    }
  }

  async function handleDataUpload() {
    if (!customerFile || !orderFile) {
      setUploadError('Please select both files.');
      return;
    }
    setUploading(true);
    setUploadError('');
    try {
      await uploadCustomerCSV(customerFile);
      await uploadOrderCSV(orderFile);
      next();
    } catch {
      setUploadError('Invalid file format. Please check your CSV files.');
    } finally {
      setUploading(false);
    }
  }

  async function handleFinish() {
    if (isSettingUp) return;

    if (!useDemoData && (!customerFile || !orderFile)) {
      setSetupError('Missing data files. Please go back and try again.');
      return;
    }

    setIsSettingUp(true);
    setStep('setup');
    setDoneItems([]);
    setIngestionMessage('');
    setSetupError('');

    try {
      const { sessionId } = useDemoData ? await seedDemoData() : await startIngestion(customerFile!, orderFile!);

      let ingestionDone = false;
      let polls = 0;

      while (!ingestionDone && polls < MAX_POLLS) {
        polls++;
        await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
        let status: { step: string; message?: string } | null = null;
        try {
          status = await getIngestionStatus(sessionId);
        } catch {
          continue;
        }

        if (!status) continue;

        setIngestionMessage(status.message || '');
        setDoneItems(Array.from({ length: getDoneCount(status.step) }, (_, i) => i));

        if (status.step === 'completed') {
          setDoneItems([0, 1, 2, 3]);
          ingestionDone = true;
        } else if (status.step === 'error') {
          throw new Error('Something went wrong processing your data. Your upload was saved, please contact support.');
        }
      }

      if (!ingestionDone) {
        throw new Error('This is taking longer than expected. Your data is still being processed, please refresh in a minute.');
      }

      setDoneItems(SETUP_ITEMS.map((_, i) => i));

      const goalLabel = GOAL_LABELS[goal] || goal;
      saveOnboardingProfile({ companyName, industry, primaryGoal: goalLabel, operatingMode: mode }).catch(() => {});
      createAgent(
        goalLabel,
        { channels: AGENT_CHANNELS, max_budget: AGENT_MAX_BUDGET, frequency_cap: AGENT_FREQUENCY_CAP },
        mode === 'autonomous' ? 'autonomous_within_policy' : 'manual',
      ).catch(() => {});
      await generateOpportunities().catch(() => {});

      const supabase = createClient();
      await supabase.auth.updateUser({ data: { onboarding_complete: true } });
      await supabase.auth.refreshSession();

      window.location.href = '/dashboard';
    } catch (err) {
      setSetupError(err instanceof Error ? err.message : typeof err === 'string' ? err : 'Setup failed. Please try again.');
      setIsSettingUp(false);
    }
  }

  if (step === 'setup') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#0A0E1A] bg-[radial-gradient(circle_at_50%_0%,rgba(91,79,255,0.28),transparent_55%)] px-6 py-10 text-white">
        <div className="w-full max-w-md">
          <div className="text-center">
            <AiOrb size="lg" state="connecting" theme="dark" className="mx-auto" />
            <h1 className="mt-6 text-2xl font-semibold tracking-tight">Your agent is learning your business</h1>
            <p className="mt-1.5 text-sm text-[#8B92A5]">This takes about 30 to 60 seconds.</p>
          </div>

          <ol className="mt-8 space-y-2">
            {SETUP_ITEMS.map((label, i) => {
              const isDone = doneItems.includes(i);
              const isActive = !isDone && i === doneItems.length;
              return (
                <li
                  key={label}
                  className={cn(
                    'flex items-center gap-3 rounded-xl border px-4 py-3 text-sm transition-colors duration-500',
                    isDone && 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200',
                    isActive && 'border-[#5B4FFF]/50 bg-[#5B4FFF]/10 text-white',
                    !isDone && !isActive && 'border-[#1E2545] text-[#5E6680]',
                  )}
                >
                  {isDone ? (
                    <Check className="size-4 text-emerald-400" aria-hidden />
                  ) : isActive ? (
                    <Loader2 className="size-4 text-[#A89DFF] motion-safe:animate-spin" aria-hidden />
                  ) : (
                    <span className="size-4 rounded-full border border-[#1E2545]" aria-hidden />
                  )}
                  {label}
                </li>
              );
            })}
          </ol>

          {ingestionMessage && !setupError && <p className="mt-4 text-center text-xs text-[#8B92A5]">{ingestionMessage}</p>}

          {setupError && (
            <div role="alert" className="mt-6 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-4 text-center">
              <p className="text-sm text-red-200">{setupError}</p>
              <button
                type="button"
                onClick={() => {
                  setStep('mode');
                  setIsSettingUp(false);
                  setSetupError('');
                }}
                className="mt-3 text-sm font-medium text-red-300 underline underline-offset-2"
              >
                Go back and try again
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  const copy = AGENT_LINES[step];
  const formIndex = FORM_STEPS.indexOf(step);
  const progress = formIndex >= 0 ? { index: formIndex, total: FORM_STEPS.length } : undefined;

  return (
    <OnboardingShell title={copy.title} body={copy.body} progress={progress}>
      {formIndex > 0 && (
        <button type="button" onClick={back} className="mb-6 flex items-center gap-1.5 text-sm text-[#9CA3AF] transition-colors hover:text-[#1A1A1A]">
          <ArrowLeft className="size-4" aria-hidden /> Back
        </button>
      )}

      {step === 'welcome' && (
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-[#1A1A1A]">Welcome to GrowthOS</h1>
          <p className="mt-3 text-base leading-relaxed text-[#6B7280]">
            Four quick steps and your agent starts finding revenue you are leaving on the table.
          </p>
          <button type="button" onClick={next} className={cn(primaryButton, 'mt-8')}>
            Get started <ArrowRight className="size-4" aria-hidden />
          </button>
        </div>
      )}

      {step === 'company' && (
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[#1A1A1A]">Tell us about your brand</h1>
          <label className="mt-6 block text-sm font-medium text-[#374151]" htmlFor="company-name">
            Brand or company name
          </label>
          <input
            id="company-name"
            type="text"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCompanyContinue()}
            placeholder="e.g. Zara India, Nykaa, Lenskart"
            className="mt-2 w-full rounded-xl border border-[#E5E7EB] px-4 py-3 text-sm text-[#1A1A1A] outline-none transition-colors placeholder:text-[#9CA3AF] focus:border-[#5B4FFF]"
          />
          <p className="mt-6 text-sm font-medium text-[#374151]">Industry</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {INDUSTRIES.map((ind) => (
              <Choice key={ind.value} selected={industry === ind.value} onClick={() => setIndustry(ind.value)} icon={ind.icon} label={ind.label} />
            ))}
          </div>
          {companyError && (
            <p role="alert" className="mt-4 text-xs text-red-600">
              {companyError}
            </p>
          )}
          <button type="button" onClick={handleCompanyContinue} disabled={!companyName.trim() || !industry || creatingCompany} className={cn(primaryButton, 'mt-8')}>
            {creatingCompany ? (
              <>
                <Loader2 className="size-4 motion-safe:animate-spin" aria-hidden /> Saving
              </>
            ) : (
              <>
                Continue <ArrowRight className="size-4" aria-hidden />
              </>
            )}
          </button>
        </div>
      )}

      {step === 'data' && (
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[#1A1A1A]">Connect your customer data</h1>
          <p className="mt-2 text-sm text-[#6B7280]">Upload customers and orders as CSV files.</p>
          <div className="mt-6 space-y-3">
            <FileDrop file={customerFile} onPick={setCustomerFile} label="Customers CSV" hint="customer_id, name, email, phone, city" />
            <FileDrop file={orderFile} onPick={setOrderFile} label="Orders CSV" hint="order_id, customer_id, date, amount, product" />
          </div>
          {uploadError && (
            <p role="alert" className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
              {uploadError}
            </p>
          )}
          <button type="button" onClick={handleDataUpload} disabled={!customerFile || !orderFile || uploading} className={cn(primaryButton, 'mt-6')}>
            {uploading ? (
              <>
                <Loader2 className="size-4 motion-safe:animate-spin" aria-hidden /> Validating
              </>
            ) : (
              <>
                Upload and continue <ArrowRight className="size-4" aria-hidden />
              </>
            )}
          </button>
          <div className="my-4 flex items-center gap-3 text-xs text-[#9CA3AF]">
            <span className="h-px flex-1 bg-[#E5E7EB]" /> or <span className="h-px flex-1 bg-[#E5E7EB]" />
          </div>
          <button
            type="button"
            onClick={() => {
              setUseDemoData(true);
              next();
            }}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#E5E7EB] py-3 text-sm font-medium text-[#374151] transition-colors hover:border-[#5B4FFF] hover:text-[#5B4FFF]"
          >
            Try it with {DEMO_CUSTOMERS} sample customers <ArrowRight className="size-4" aria-hidden />
          </button>
          <p className="mt-2 text-center text-[11px] text-[#9CA3AF]">
            Imports {DEMO_CUSTOMERS} customers and {DEMO_ORDERS} orders into your workspace so you can try the pipeline first.
          </p>
        </div>
      )}

      {step === 'goal' && (
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[#1A1A1A]">What is your primary growth goal?</h1>
          <div className="mt-6 flex flex-col gap-2">
            {GOALS.map((g) => (
              <Choice key={g.value} selected={goal === g.value} onClick={() => setGoal(g.value)} icon={g.icon} label={g.label} />
            ))}
          </div>
          <button type="button" onClick={next} disabled={!goal} className={cn(primaryButton, 'mt-8')}>
            Continue <ArrowRight className="size-4" aria-hidden />
          </button>
        </div>
      )}

      {step === 'mode' && (
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[#1A1A1A]">How should the agent work?</h1>
          <p className="mt-2 text-sm text-[#6B7280]">You can change this at any time.</p>
          <div className="mt-6 grid gap-3">
            <Choice
              selected={mode === 'operator'}
              onClick={() => setMode('operator')}
              icon={ShieldCheck}
              label="Operator"
              hint="The agent drafts campaigns. You approve before anything is sent."
            />
            <div className="flex items-center gap-3 rounded-xl border border-[#E5E7EB] p-4 opacity-60">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#F3F4F6] text-[#6B7280]">
                <Zap className="size-4" aria-hidden />
              </span>
              <span>
                <span className="block text-sm font-medium text-[#1A1A1A]">Autonomous, coming soon</span>
                <span className="block text-xs text-[#9CA3AF]">Available after launch policy, approval audit and recipient safety controls are on.</span>
              </span>
            </div>
          </div>
          <PrimaryAction onClick={handleFinish} disabled={isSettingUp} className="mt-8 w-full">
            Launch your agent <Zap className="size-4" aria-hidden />
          </PrimaryAction>
        </div>
      )}
    </OnboardingShell>
  );
}

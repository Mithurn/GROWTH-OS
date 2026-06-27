'use client';

import { useState, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  ArrowLeft,
  Sparkles,
  ShoppingBag,
  Zap,
  Coffee,
  Cpu,
  Home,
  Store,
  UploadCloud,
  Check,
  TrendingUp,
  RefreshCcw,
  HeartHandshake,
  BadgeIndianRupee,
  Users,
  Bot,
  ShieldCheck,
} from 'lucide-react';
import {
  saveBusinessInfo,
  uploadCustomerCSV,
  uploadOrderCSV,
  startIngestion,
  getIngestionStatus,
  saveOnboardingProfile,
  createAgent,
  generateOpportunities,
} from '@/lib/api';

function Logo() {
  return (
    <Link href="/">
      <Image src="/logo.png" alt="GrowthOS" width={120} height={40} className="object-contain" />
    </Link>
  );
}

type Step = 'welcome' | 'company' | 'data' | 'goal' | 'mode' | 'setup';

const INDUSTRIES = [
  { value: 'fashion', label: 'Fashion', icon: ShoppingBag, color: '#8B5CF6' },
  { value: 'beauty', label: 'Beauty', icon: Sparkles, color: '#EC4899' },
  { value: 'food', label: 'Food & Beverage', icon: Coffee, color: '#F59E0B' },
  { value: 'electronics', label: 'Electronics', icon: Cpu, color: '#3B82F6' },
  { value: 'home', label: 'Home & Living', icon: Home, color: '#10B981' },
  { value: 'other', label: 'Other Retail', icon: Store, color: '#6B7280' },
];

const GOALS = [
  { value: 'repeat', label: 'Increase Repeat Purchases', icon: RefreshCcw, color: '#8B5CF6' },
  { value: 'churn', label: 'Reduce Churn', icon: TrendingUp, color: '#EF4444' },
  { value: 'loyalty', label: 'Grow Loyalty', icon: HeartHandshake, color: '#EC4899' },
  { value: 'aov', label: 'Increase Average Order Value', icon: BadgeIndianRupee, color: '#F59E0B' },
  { value: 'acquire', label: 'Acquire New Customers', icon: Users, color: '#10B981' },
];

const GOAL_LABELS: Record<string, string> = {
  repeat: 'Increase Repeat Purchases',
  churn: 'Reduce Churn',
  loyalty: 'Grow Loyalty',
  aov: 'Increase Average Order Value',
  acquire: 'Acquire New Customers',
};

const SETUP_ITEMS = [
  'Validating your data',
  'Importing customer & order history',
  'Building customer profiles',
  'Generating AI personas',
  'Setting up your AI growth team',
  'Ready to grow',
];

// Maps backend ingestion step → how many checklist items are done
function getDoneCount(step: string): number {
  const map: Record<string, number> = {
    validating: 0,
    parsing: 0,
    seeding_products: 0,
    importing_customers: 1,
    importing_orders: 1,
    calculating_metrics: 2,
    validating_metrics: 2,
    calculating_attributes: 2,
    validating_attributes: 2,
    generating_personas: 3,
    personas_complete: 3,
    personas_skipped: 3,
    completed: 4,
  };
  return map[step] ?? 0;
}

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('welcome');

  // Company + industry
  const [companyName, setCompanyName] = useState('');
  const [industry, setIndustry] = useState('');
  const [creatingCompany, setCreatingCompany] = useState(false);
  const [companyError, setCompanyError] = useState('');

  // Data files — kept in state so we can send them during setup
  const [customerFile, setCustomerFile] = useState<File | null>(null);
  const [orderFile, setOrderFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [useDemoData, setUseDemoData] = useState(false);

  // Goal + mode
  const [goal, setGoal] = useState('');
  const [mode, setMode] = useState<'operator' | 'autonomous'>('operator');

  // Setup animation
  const [isSettingUp, setIsSettingUp] = useState(false);
  const [doneItems, setDoneItems] = useState<number[]>([]);
  const [ingestionMessage, setIngestionMessage] = useState('');
  const [setupError, setSetupError] = useState('');

  const customerInputRef = useRef<HTMLInputElement>(null);
  const orderInputRef = useRef<HTMLInputElement>(null);

  // For progress bar (setup is not in the bar)
  const STEPS: Step[] = ['welcome', 'company', 'data', 'goal', 'mode'];
  const stepIndex = STEPS.indexOf(step);

  function next() {
    const order: Step[] = ['welcome', 'company', 'data', 'goal', 'mode', 'setup'];
    const i = order.indexOf(step);
    if (i < order.length - 1) setStep(order[i + 1]);
  }

  function back() {
    const order: Step[] = ['welcome', 'company', 'data', 'goal', 'mode', 'setup'];
    const i = order.indexOf(step);
    if (i > 0) setStep(order[i - 1]);
  }

  // ── Step 1: Create company in DB, store companyId ──────────────────────────
  async function handleCompanyContinue() {
    if (!companyName.trim() || !industry) return;
    setCreatingCompany(true);
    setCompanyError('');
    try {
      const res = await saveBusinessInfo(companyName.trim(), industry);
      const id = res?.data?.id;
      if (!id) throw new Error('No company ID returned');
      window.localStorage.setItem('growthOS_company_id', id);
      next();
    } catch {
      setCompanyError('Failed to save. Please try again.');
    } finally {
      setCreatingCompany(false);
    }
  }

  // ── Step 2: Validate files only — actual ingestion happens in setup ─────────
  async function handleDataUpload() {
    if (!customerFile || !orderFile) {
      setUploadError('Please select both files.');
      return;
    }
    setUploading(true);
    setUploadError('');
    try {
      // Preview calls validate CSV format without writing to DB
      await uploadCustomerCSV(customerFile);
      await uploadOrderCSV(orderFile);
      next();
    } catch {
      setUploadError('Invalid file format. Please check your CSV files.');
    } finally {
      setUploading(false);
    }
  }

  // ── Final step: real pipeline with polling ─────────────────────────────────
  async function handleFinish() {
    // Double-click guard
    if (isSettingUp) return;

    const storedCompanyId = window.localStorage.getItem('growthOS_company_id');
    if (!storedCompanyId || (!useDemoData && (!customerFile || !orderFile))) {
      setSetupError('Missing company or data files. Please go back and try again.');
      return;
    }

    setIsSettingUp(true);
    setStep('setup');
    setDoneItems([]);
    setIngestionMessage('');
    setSetupError('');

    try {
      if (useDemoData) {
        // Force the company ID to the one that has our demo data
        window.localStorage.setItem('growthOS_company_id', '1bac1f55-82ad-4d34-a5e2-42ec8d7794da');
        
        let currentStep = 0;
        const steps = ['validating', 'importing_customers', 'calculating_metrics', 'generating_personas', 'completed'];
        
        while (currentStep < steps.length) {
          await new Promise(r => setTimeout(r, 1200));
          const statusStep = steps[currentStep];
          setIngestionMessage(`Processing ${statusStep.replace('_', ' ')}...`);
          const count = getDoneCount(statusStep);
          setDoneItems(Array.from({ length: count }, (_, i) => i));
          
          if (statusStep === 'completed') {
            setDoneItems([0, 1, 2, 3]);
            break;
          }
          currentStep++;
        }
      } else {
        // 1. Kick off ingestion pipeline with both CSV files
        const { sessionId } = await startIngestion(customerFile!, orderFile!);

        // 2. Poll until backend pipeline completes
        let ingestionDone = false;
        let retries = 0;
        const MAX_RETRIES = 200; // 200 × 1.5s = 5 min — covers AI persona generation

        while (!ingestionDone && retries < MAX_RETRIES) {
          retries++;
          await new Promise(r => setTimeout(r, 1500));
          const status = await getIngestionStatus(sessionId);

          setIngestionMessage(status.message || '');
          const count = getDoneCount(status.step);
          setDoneItems(Array.from({ length: count }, (_, i) => i));

          if (status.step === 'completed') {
            setDoneItems([0, 1, 2, 3]);
            ingestionDone = true;
          } else if (status.step === 'error') {
            throw new Error(status.message || 'Data ingestion failed');
          }
        }

        if (!ingestionDone) {
          throw new Error('Setup timed out. Please try again.');
        }
      }

      // 3. In parallel: save brand profile + generate opportunities
      // Item 4 "Setting up your AI growth team" becomes active
      const goalLabel = GOAL_LABELS[goal] || goal;
      await Promise.all([
        saveOnboardingProfile(storedCompanyId, {
          companyName,
          industry,
          primaryGoal: goalLabel,
          operatingMode: mode,
        }),
        generateOpportunities(storedCompanyId).catch(() => {
          // Non-blocking — opportunities page will regenerate if this fails
        }),
      ]);

      // 4. Create AI agent
      await createAgent(storedCompanyId, goalLabel, {
        channels: ['WhatsApp', 'Email'],
        involvement: mode === 'autonomous' ? 'autopilot' : 'review every campaign',
        max_budget: 100000,
        frequency_cap: 3,
      });

      setDoneItems([0, 1, 2, 3, 4]);

      // Brief pause so the user sees "Setting up your AI growth team" tick
      await new Promise(r => setTimeout(r, 800));
      setDoneItems([0, 1, 2, 3, 4, 5]);
      await new Promise(r => setTimeout(r, 600));

      // Mark onboarding complete so middleware lets them through
      await createClient().auth.updateUser({ data: { onboarding_complete: true } });

      router.push('/');
    } catch (err) {
      setSetupError(err instanceof Error ? err.message : 'Setup failed. Please try again.');
      setIsSettingUp(false);
    }
  }

  // ── WELCOME ────────────────────────────────────────────────────────────────
  if (step === 'welcome') {
    return (
      <div className="min-h-screen bg-white flex flex-col">
        <header className="px-6 py-5">
          <Logo />
        </header>
        <div className="flex-1 flex flex-col items-center justify-center px-6">
          <div className="max-w-md w-full text-center">
            <div className="w-14 h-14 rounded-2xl bg-[#5B4FFF] flex items-center justify-center mx-auto mb-8">
              <Sparkles className="h-7 w-7 text-white" />
            </div>
            <h1 className="text-4xl font-black text-[#1A1A1A] mb-4 tracking-tight leading-tight">
              Welcome to GrowthOS
            </h1>
            <p className="text-base text-[#6B7280] mb-10 leading-relaxed">
              An AI-native platform that finds growth opportunities, builds customer audiences, and runs personalised campaigns for your brand.
            </p>
            <button
              onClick={next}
              className="w-full bg-[#5B4FFF] text-white text-sm font-semibold py-3.5 rounded-xl flex items-center justify-center gap-2 hover:bg-[#4B3FE5] transition-colors"
            >
              Get Started <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── SETUP ANIMATION ────────────────────────────────────────────────────────
  if (step === 'setup') {
    return (
      <div className="min-h-screen bg-white flex flex-col">
        <header className="px-6 py-5">
          <Logo />
        </header>
        <div className="flex-1 flex flex-col items-center justify-center px-6">
          <div className="max-w-md w-full">
            <div className="text-center mb-10">
              <div className="w-14 h-14 rounded-2xl bg-[#5B4FFF] flex items-center justify-center mx-auto mb-6">
                <Bot className="h-7 w-7 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-[#1A1A1A] mb-2">Setting up your AI Revenue Team</h2>
              <p className="text-sm text-[#6B7280]">Analysing your data. This takes about 30–60 seconds.</p>
            </div>

            <div className="space-y-2 mb-4">
              {SETUP_ITEMS.map((label, i) => {
                const isDone = doneItems.includes(i);
                const isActive = !isDone && i === doneItems.length;
                return (
                  <div
                    key={label}
                    className={`flex items-center gap-3 p-4 rounded-xl border transition-all duration-500 ${
                      isDone
                        ? 'bg-[#F0FDF4] border-[#86EFAC]'
                        : isActive
                        ? 'bg-[#F8F7FF] border-[#C4BFFF]'
                        : 'bg-[#FAFAFA] border-[#E5E7EB] opacity-40'
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${
                        isDone
                          ? 'bg-[#22C55E]'
                          : isActive
                          ? 'bg-[#5B4FFF] animate-pulse'
                          : 'bg-[#E5E7EB]'
                      }`}
                    >
                      {isDone && <Check className="h-3 w-3 text-white" />}
                    </div>
                    <span className={`text-sm font-medium ${isDone ? 'text-[#166534]' : 'text-[#374151]'}`}>
                      {label}
                    </span>
                  </div>
                );
              })}
            </div>

            {ingestionMessage && !setupError && (
              <p className="text-xs text-[#9CA3AF] text-center mt-3">{ingestionMessage}</p>
            )}

            {setupError && (
              <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-4 text-center">
                <p className="text-sm font-medium text-red-700 mb-3">{setupError}</p>
                <button
                  onClick={() => { setStep('mode'); setIsSettingUp(false); setSetupError(''); }}
                  className="text-sm font-semibold text-red-600 underline underline-offset-2"
                >
                  Go back and try again
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── STEP WRAPPER (company / data / goal / mode) ────────────────────────────
  return (
    <div className="min-h-screen bg-white flex flex-col">
      <header className="px-6 py-5">
        <Logo />
      </header>

      {/* Progress bar — only for named steps */}
      <div className="w-full h-0.5 bg-[#F3F4F6]">
        <div
          className="h-full bg-[#5B4FFF] transition-all duration-500"
          style={{ width: stepIndex > 0 ? `${((stepIndex - 1) / (STEPS.length - 2)) * 100}%` : '0%' }}
        />
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-xl">

          {stepIndex > 1 && (
            <button
              onClick={back}
              className="flex items-center gap-1.5 text-sm text-[#9CA3AF] hover:text-[#1A1A1A] mb-8 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" /> Back
            </button>
          )}

          {/* ── COMPANY + INDUSTRY ── */}
          {step === 'company' && (
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-[#5B4FFF] mb-3">Step 1 of 4</p>
              <h2 className="text-3xl font-black text-[#1A1A1A] mb-2">Tell us about your brand</h2>
              <p className="text-[#6B7280] mb-8">This helps GrowthOS tailor its AI to your market.</p>

              {/* Company name */}
              <div className="mb-6">
                <label className="block text-sm font-bold text-[#374151] mb-2">Brand / Company Name</label>
                <input
                  type="text"
                  value={companyName}
                  onChange={e => setCompanyName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleCompanyContinue()}
                  placeholder="e.g. Zara India, Nykaa, Lenskart"
                  className="w-full px-4 py-3 rounded-xl border-2 border-[#E5E7EB] text-sm text-[#1A1A1A] placeholder:text-[#9CA3AF] outline-none focus:border-[#5B4FFF] transition-colors"
                />
              </div>

              {/* Industry grid */}
              <div className="mb-8">
                <label className="block text-sm font-bold text-[#374151] mb-3">Industry</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {INDUSTRIES.map(ind => {
                    const Icon = ind.icon;
                    const selected = industry === ind.value;
                    return (
                      <button
                        key={ind.value}
                        onClick={() => setIndustry(ind.value)}
                        className={`relative p-5 rounded-xl border-2 text-left transition-all hover:scale-[1.02] active:scale-[0.98] ${
                          selected ? 'border-[#5B4FFF] bg-[#F8F7FF]' : 'border-[#E5E7EB] bg-white hover:border-[#C4BFFF]'
                        }`}
                      >
                        {selected && (
                          <div className="absolute top-3 right-3 w-5 h-5 bg-[#5B4FFF] rounded-full flex items-center justify-center">
                            <Check className="h-3 w-3 text-white" />
                          </div>
                        )}
                        <div
                          className="w-9 h-9 rounded-lg mb-3 flex items-center justify-center"
                          style={{ backgroundColor: `${ind.color}18` }}
                        >
                          <Icon className="h-5 w-5" style={{ color: ind.color }} />
                        </div>
                        <div className="text-sm font-bold text-[#1A1A1A]">{ind.label}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {companyError && <p className="text-xs text-red-500 mb-4">{companyError}</p>}

              <button
                onClick={handleCompanyContinue}
                disabled={!companyName.trim() || !industry || creatingCompany}
                className="w-full bg-[#5B4FFF] text-white text-sm font-semibold py-3.5 rounded-xl flex items-center justify-center gap-2 hover:bg-[#4B3FE5] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {creatingCompany ? (
                  <><div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Saving...</>
                ) : (
                  <>Continue <ArrowRight className="h-4 w-4" /></>
                )}
              </button>
            </div>
          )}

          {/* ── DATA UPLOAD ── */}
          {step === 'data' && (
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-[#5B4FFF] mb-3">Step 2 of 4</p>
              <h2 className="text-3xl font-black text-[#1A1A1A] mb-2">Connect your customer data</h2>
              <p className="text-[#6B7280] mb-8">
                Upload your customers and orders as CSV files. GrowthOS will analyse them instantly.
              </p>

              <div className="space-y-3 mb-6 pointer-events-none opacity-50">
                <div className="border-2 border-dashed rounded-xl p-5 border-[#E5E7EB]">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-[#F3F4F6]">
                      <UploadCloud className="h-5 w-5 text-[#9CA3AF]" />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-[#1A1A1A]">Upload Customers CSV</div>
                      <div className="text-xs text-[#9CA3AF] mt-0.5">customer_id, name, email, phone, city...</div>
                    </div>
                  </div>
                </div>

                <div className="border-2 border-dashed rounded-xl p-5 border-[#E5E7EB]">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-[#F3F4F6]">
                      <UploadCloud className="h-5 w-5 text-[#9CA3AF]" />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-[#1A1A1A]">Upload Orders CSV</div>
                      <div className="text-xs text-[#9CA3AF] mt-0.5">order_id, customer_id, date, amount, product...</div>
                    </div>
                  </div>
                </div>
              </div>

              <button
                disabled
                className="w-full bg-[#5B4FFF] text-white text-sm font-semibold py-3.5 rounded-xl flex items-center justify-center gap-2 opacity-40 cursor-not-allowed mb-3"
              >
                Upload & Continue <ArrowRight className="h-4 w-4" />
              </button>

              <button
                onClick={() => {
                  window.localStorage.setItem('growthOS_company_id', '1bac1f55-82ad-4d34-a5e2-42ec8d7794da');
                  setUseDemoData(true);
                  next();
                }}
                className="w-full bg-[#5B4FFF] text-white text-sm font-semibold py-3.5 rounded-xl flex items-center justify-center gap-2 hover:bg-[#4B3FE5] transition-colors"
              >
                Connect Pre-loaded Demo Data <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* ── PRIMARY GOAL ── */}
          {step === 'goal' && (
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-[#5B4FFF] mb-3">Step 3 of 4</p>
              <h2 className="text-3xl font-black text-[#1A1A1A] mb-2">What is your primary growth goal?</h2>
              <p className="text-[#6B7280] mb-8">GrowthOS will optimise every decision around this objective.</p>

              <div className="flex flex-col gap-2 mb-8">
                {GOALS.map(g => {
                  const Icon = g.icon;
                  const selected = goal === g.value;
                  return (
                    <button
                      key={g.value}
                      onClick={() => setGoal(g.value)}
                      className={`flex items-center gap-4 p-4 rounded-xl border-2 text-left transition-all hover:scale-[1.01] active:scale-[0.99] ${
                        selected ? 'border-[#5B4FFF] bg-[#F8F7FF]' : 'border-[#E5E7EB] bg-white hover:border-[#C4BFFF]'
                      }`}
                    >
                      <div
                        className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                        style={{ backgroundColor: `${g.color}15` }}
                      >
                        <Icon className="h-5 w-5" style={{ color: g.color }} />
                      </div>
                      <span className="text-sm font-bold text-[#1A1A1A]">{g.label}</span>
                      {selected && (
                        <div className="ml-auto w-5 h-5 bg-[#5B4FFF] rounded-full flex items-center justify-center shrink-0">
                          <Check className="h-3 w-3 text-white" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>

              <button
                onClick={next}
                disabled={!goal}
                className="w-full bg-[#5B4FFF] text-white text-sm font-semibold py-3.5 rounded-xl flex items-center justify-center gap-2 hover:bg-[#4B3FE5] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Continue <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* ── AI MODE ── */}
          {step === 'mode' && (
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-[#5B4FFF] mb-3">Step 4 of 4</p>
              <h2 className="text-3xl font-black text-[#1A1A1A] mb-2">How should GrowthOS work?</h2>
              <p className="text-[#6B7280] mb-8">
                Choose how much autonomy you give your AI team. You can change this at any time.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
                <button
                  onClick={() => setMode('operator')}
                  className={`p-6 rounded-xl border-2 text-left transition-all hover:scale-[1.02] active:scale-[0.98] ${
                    mode === 'operator' ? 'border-[#5B4FFF] bg-[#F8F7FF]' : 'border-[#E5E7EB] bg-white hover:border-[#C4BFFF]'
                  }`}
                >
                  <div className="w-10 h-10 rounded-lg bg-[#FEF3C7] flex items-center justify-center mb-4">
                    <ShieldCheck className="h-5 w-5 text-[#D97706]" />
                  </div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-black text-[#1A1A1A]">Operator</span>
                    {mode === 'operator' && (
                      <div className="w-5 h-5 bg-[#5B4FFF] rounded-full flex items-center justify-center">
                        <Check className="h-3 w-3 text-white" />
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-[#6B7280] leading-relaxed">
                    GrowthOS discovers opportunities, builds audiences, and drafts campaigns.{' '}
                    <span className="font-semibold text-[#374151]">You approve before launch.</span>
                  </p>
                </button>

                <button
                  onClick={() => setMode('autonomous')}
                  className={`p-6 rounded-xl border-2 text-left transition-all hover:scale-[1.02] active:scale-[0.98] ${
                    mode === 'autonomous' ? 'border-[#5B4FFF] bg-[#F8F7FF]' : 'border-[#E5E7EB] bg-white hover:border-[#C4BFFF]'
                  }`}
                >
                  <div className="w-10 h-10 rounded-lg bg-[#F0EEFF] flex items-center justify-center mb-4">
                    <Zap className="h-5 w-5 text-[#5B4FFF]" />
                  </div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-black text-[#1A1A1A]">Autonomous</span>
                    {mode === 'autonomous' && (
                      <div className="w-5 h-5 bg-[#5B4FFF] rounded-full flex items-center justify-center">
                        <Check className="h-3 w-3 text-white" />
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-[#6B7280] leading-relaxed">
                    GrowthOS discovers opportunities, creates campaigns, and launches automatically.{' '}
                    <span className="font-semibold text-[#374151]">Full autopilot.</span>
                  </p>
                </button>
              </div>

              <button
                onClick={handleFinish}
                disabled={isSettingUp}
                className="w-full bg-[#5B4FFF] text-white text-sm font-semibold py-3.5 rounded-xl flex items-center justify-center gap-2 hover:bg-[#4B3FE5] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Launch AI Team <Zap className="h-4 w-4" />
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

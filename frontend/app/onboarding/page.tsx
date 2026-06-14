'use client';

import { useState, useRef } from 'react';
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
  Target,
} from 'lucide-react';
import { uploadCustomerCSV, uploadOrderCSV, saveOnboardingProfile } from '@/lib/api';

function Logo() {
  return (
    <Link href="/" className="flex items-center gap-1.5">
      <div className="flex flex-wrap w-5 h-5 gap-0.5">
        <div className="w-[9px] h-[9px] rounded-full bg-[#3B82F6]" />
        <div className="w-[9px] h-[9px] rounded-full bg-[#3B82F6]" />
        <div className="w-[9px] h-[9px] rounded-full bg-[#3B82F6]" />
        <div className="w-[9px] h-[9px] rounded-full bg-[#3B82F6]" />
      </div>
      <span className="text-[22px] font-semibold text-[#3B82F6] tracking-tight leading-none">xeno</span>
    </Link>
  );
}

type Step = 'welcome' | 'industry' | 'data' | 'goal' | 'mode' | 'setup';

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

const SETUP_ITEMS = [
  'Learning your growth priorities',
  'Configuring decision-making preferences',
  'Assigning specialized growth agents',
  'Preparing your workspace',
  'Ready',
];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('welcome');
  const [industry, setIndustry] = useState('');
  const [goal, setGoal] = useState('');
  const [mode, setMode] = useState<'operator' | 'autonomous'>('operator');

  const [customerFile, setCustomerFile] = useState<File | null>(null);
  const [orderFile, setOrderFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');

  const [doneItems, setDoneItems] = useState<number[]>([]);

  const customerInputRef = useRef<HTMLInputElement>(null);
  const orderInputRef = useRef<HTMLInputElement>(null);

  const STEPS: Step[] = ['welcome', 'industry', 'data', 'goal', 'mode'];
  const stepIndex = STEPS.indexOf(step);

  function next() {
    const order: Step[] = ['welcome', 'industry', 'data', 'goal', 'mode', 'setup'];
    const i = order.indexOf(step);
    if (i < order.length - 1) setStep(order[i + 1]);
  }

  function back() {
    const order: Step[] = ['welcome', 'industry', 'data', 'goal', 'mode', 'setup'];
    const i = order.indexOf(step);
    if (i > 0) setStep(order[i - 1]);
  }

  async function handleDataUpload() {
    if (!customerFile || !orderFile) {
      setUploadError('Please select both files.');
      return;
    }
    try {
      setUploading(true);
      setUploadError('');
      const customerRes = await uploadCustomerCSV(customerFile);
      const companyId = customerRes?.companyId || customerRes?.data?.companyId;
      if (companyId) window.localStorage.setItem('xeno_company_id', companyId);
      await uploadOrderCSV(orderFile);
      next();
    } catch {
      setUploadError('Upload failed. Please check your files and try again.');
    } finally {
      setUploading(false);
    }
  }

  async function handleFinish() {
    setStep('setup');

    for (let i = 0; i < SETUP_ITEMS.length; i++) {
      await new Promise(r => setTimeout(r, 900));
      setDoneItems(prev => [...prev, i]);
    }

    try {
      const storedCompanyId = window.localStorage.getItem('xeno_company_id');
      if (storedCompanyId) {
        await saveOnboardingProfile(storedCompanyId, {
          industry,
          primaryGoal: goal,
          operatingMode: mode,
        });
      }
    } catch (e) {
      console.error('Profile save error:', e);
    }

    await new Promise(r => setTimeout(r, 600));
    router.push('/');
  }

  // ── WELCOME ──────────────────────────────────────────────────────────────────
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

            <h1 className="text-4xl font-black text-[#1A1A1A] mb-8 tracking-tight leading-tight">
              Welcome to Xeno Growth OS
            </h1>

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

  // ── SETUP ANIMATION ──────────────────────────────────────────────────────────
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
            <p className="text-sm text-[#6B7280]">This will take just a moment.</p>
          </div>

          <div className="space-y-2 mb-10">
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
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${isDone ? 'bg-[#22C55E]' : isActive ? 'bg-[#5B4FFF] animate-pulse' : 'bg-[#E5E7EB]'}`}>
                    {isDone && <Check className="h-3 w-3 text-white" />}
                  </div>
                  <span className={`text-sm font-medium ${isDone ? 'text-[#166534]' : 'text-[#374151]'}`}>{label}</span>
                </div>
              );
            })}
          </div>

          <div className="grid grid-cols-2 gap-3">
            {[
              { name: 'Retention Agent', desc: 'Keeps customers coming back' },
              { name: 'Revenue Agent', desc: 'Finds repeat purchase opportunities' },
            ].map(agent => (
              <div key={agent.name} className="bg-[#FAFAFA] border border-[#E5E7EB] rounded-xl p-4">
                <div className="w-8 h-8 bg-[#5B4FFF] rounded-lg mb-3 flex items-center justify-center">
                  <Bot className="h-4 w-4 text-white" />
                </div>
                <div className="text-sm font-bold text-[#1A1A1A]">{agent.name}</div>
                <div className="text-xs text-[#6B7280] mt-0.5">{agent.desc}</div>
              </div>
            ))}
          </div>
        </div>
        </div>
      </div>
    );
  }

  // ── STEP WRAPPER ─────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-white flex flex-col">
      <header className="px-6 py-5">
        <Logo />
      </header>
      {/* Progress bar */}
      <div className="w-full h-0.5 bg-[#F3F4F6]">
        <div
          className="h-full bg-[#5B4FFF] transition-all duration-500"
          style={{ width: `${(stepIndex / (STEPS.length - 1)) * 100}%` }}
        />
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-xl">

          {stepIndex > 0 && (
            <button onClick={back} className="flex items-center gap-1.5 text-sm text-[#9CA3AF] hover:text-[#1A1A1A] mb-8 transition-colors">
              <ArrowLeft className="h-4 w-4" /> Back
            </button>
          )}

          {/* ── INDUSTRY ── */}
          {step === 'industry' && (
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-[#5B4FFF] mb-3">Step 1 of 4</p>
              <h2 className="text-3xl font-black text-[#1A1A1A] mb-2">What industry are you in?</h2>
              <p className="text-[#6B7280] mb-8">This helps Xeno tailor its models to your specific market.</p>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-8">
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
                      <div className="w-9 h-9 rounded-lg mb-3 flex items-center justify-center" style={{ backgroundColor: `${ind.color}18` }}>
                        <Icon className="h-5 w-5" style={{ color: ind.color }} />
                      </div>
                      <div className="text-sm font-bold text-[#1A1A1A]">{ind.label}</div>
                    </button>
                  );
                })}
              </div>

              <button
                onClick={next}
                disabled={!industry}
                className="w-full bg-[#5B4FFF] text-white text-sm font-semibold py-3.5 rounded-xl flex items-center justify-center gap-2 hover:bg-[#4B3FE5] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Continue <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* ── DATA UPLOAD ── */}
          {step === 'data' && (
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-[#5B4FFF] mb-3">Step 2 of 4</p>
              <h2 className="text-3xl font-black text-[#1A1A1A] mb-2">Connect your customer data</h2>
              <p className="text-[#6B7280] mb-8">Upload your customers and orders as CSV files. Xeno will analyse them instantly.</p>

              <div className="space-y-3 mb-6">
                <div
                  onClick={() => customerInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl p-5 cursor-pointer transition-all hover:border-[#5B4FFF] hover:bg-[#F8F7FF] ${customerFile ? 'border-[#5B4FFF] bg-[#F8F7FF]' : 'border-[#E5E7EB]'}`}
                >
                  <input ref={customerInputRef} type="file" accept=".csv" className="hidden" onChange={e => setCustomerFile(e.target.files?.[0] || null)} />
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${customerFile ? 'bg-[#5B4FFF]' : 'bg-[#F3F4F6]'}`}>
                      {customerFile ? <Check className="h-5 w-5 text-white" /> : <UploadCloud className="h-5 w-5 text-[#9CA3AF]" />}
                    </div>
                    <div>
                      <div className="text-sm font-bold text-[#1A1A1A]">{customerFile ? customerFile.name : 'Upload Customers CSV'}</div>
                      <div className="text-xs text-[#9CA3AF] mt-0.5">customer_id, name, email, phone, city...</div>
                    </div>
                  </div>
                </div>

                <div
                  onClick={() => orderInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl p-5 cursor-pointer transition-all hover:border-[#5B4FFF] hover:bg-[#F8F7FF] ${orderFile ? 'border-[#5B4FFF] bg-[#F8F7FF]' : 'border-[#E5E7EB]'}`}
                >
                  <input ref={orderInputRef} type="file" accept=".csv" className="hidden" onChange={e => setOrderFile(e.target.files?.[0] || null)} />
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${orderFile ? 'bg-[#5B4FFF]' : 'bg-[#F3F4F6]'}`}>
                      {orderFile ? <Check className="h-5 w-5 text-white" /> : <UploadCloud className="h-5 w-5 text-[#9CA3AF]" />}
                    </div>
                    <div>
                      <div className="text-sm font-bold text-[#1A1A1A]">{orderFile ? orderFile.name : 'Upload Orders CSV'}</div>
                      <div className="text-xs text-[#9CA3AF] mt-0.5">order_id, customer_id, date, amount, product...</div>
                    </div>
                  </div>
                </div>
              </div>

              {uploadError && <p className="text-xs text-red-500 mb-4">{uploadError}</p>}

              <button
                onClick={handleDataUpload}
                disabled={!customerFile || !orderFile || uploading}
                className="w-full bg-[#5B4FFF] text-white text-sm font-semibold py-3.5 rounded-xl flex items-center justify-center gap-2 hover:bg-[#4B3FE5] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {uploading ? (
                  <><div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Uploading...</>
                ) : (
                  <>Upload & Continue <ArrowRight className="h-4 w-4" /></>
                )}
              </button>
            </div>
          )}

          {/* ── PRIMARY GOAL ── */}
          {step === 'goal' && (
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-[#5B4FFF] mb-3">Step 3 of 4</p>
              <h2 className="text-3xl font-black text-[#1A1A1A] mb-2">What is your primary growth goal?</h2>
              <p className="text-[#6B7280] mb-8">Xeno will optimise every decision around this objective.</p>

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
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${g.color}15` }}>
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
              <h2 className="text-3xl font-black text-[#1A1A1A] mb-2">How should Xeno work?</h2>
              <p className="text-[#6B7280] mb-8">Choose how much autonomy you give your AI team. You can change this at any time.</p>

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
                    Xeno discovers opportunities, builds audiences, and drafts campaigns.{' '}
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
                    Xeno discovers opportunities, creates campaigns, and launches automatically.{' '}
                    <span className="font-semibold text-[#374151]">Full autopilot.</span>
                  </p>
                </button>
              </div>

              <button
                onClick={handleFinish}
                className="w-full bg-[#5B4FFF] text-white text-sm font-semibold py-3.5 rounded-xl flex items-center justify-center gap-2 hover:bg-[#4B3FE5] transition-colors"
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

'use client';

import { useState, useRef } from 'react';
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
import { uploadCustomerCSV, uploadOrderCSV, saveOnboardingProfile } from '@/lib/api';

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

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('welcome');
  const [industry, setIndustry] = useState('');
  const [goal, setGoal] = useState('');
  const [mode, setMode] = useState<'operator' | 'autonomous'>('operator');
  const [companyName, setCompanyName] = useState('');

  const [customerFile, setCustomerFile] = useState<File | null>(null);
  const [orderFile, setOrderFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');

  const [setupItems, setSetupItems] = useState([
    { label: 'Learning your growth priorities', done: false },
    { label: 'Configuring decision-making preferences', done: false },
    { label: 'Assigning specialized growth agents', done: false },
    { label: 'Preparing your workspace', done: false },
    { label: 'Ready', done: false },
  ]);

  const customerInputRef = useRef<HTMLInputElement>(null);
  const orderInputRef = useRef<HTMLInputElement>(null);

  const steps: Step[] = ['welcome', 'industry', 'data', 'goal', 'mode'];
  const stepIndex = steps.indexOf(step);

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

  async function handleFinish() {
    setStep('setup');

    // Animate setup items
    for (let i = 0; i < setupItems.length; i++) {
      await new Promise(r => setTimeout(r, 800));
      setSetupItems(prev => prev.map((item, idx) => idx === i ? { ...item, done: true } : item));
    }

    try {
      const storedCompanyId = window.localStorage.getItem('xeno_company_id');
      if (storedCompanyId) {
        await saveOnboardingProfile(storedCompanyId, {
          industry,
          primaryGoal: goal,
          operatingMode: mode,
          companyName,
        });
      }
    } catch (e) {
      console.error('Profile save error:', e);
    }

    await new Promise(r => setTimeout(r, 500));
    router.push('/');
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
    } catch (e) {
      setUploadError('Upload failed. Please check your files and try again.');
    } finally {
      setUploading(false);
    }
  }

  // ─── WELCOME ────────────────────────────────────────────────────────────────
  if (step === 'welcome') {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6">
        <div className="max-w-lg w-full text-center">
          <div className="inline-flex items-center gap-2 bg-[#F0EEFF] text-[#5B4FFF] text-sm font-semibold px-4 py-2 rounded-full mb-8">
            <Sparkles className="h-4 w-4" />
            AI-Native Growth Platform
          </div>

          <h1 className="text-5xl font-black text-[#1A1A1A] mb-4 tracking-tight leading-tight">
            Welcome to<br />
            <span className="text-[#5B4FFF]">Xeno Growth OS</span>
          </h1>

          <p className="text-lg text-[#6B7280] mb-10 leading-relaxed">
            Your AI team that finds opportunities, builds audiences, and runs campaigns — so you can focus on what matters.
          </p>

          <div className="grid grid-cols-3 gap-4 mb-10">
            {[
              { icon: '🎯', label: 'Smart Segments' },
              { icon: '🤖', label: 'AI Campaigns' },
              { icon: '📈', label: 'Revenue Growth' },
            ].map(item => (
              <div key={item.label} className="bg-[#FAFAFA] border border-[#E5E7EB] rounded-2xl p-4">
                <div className="text-2xl mb-2">{item.icon}</div>
                <div className="text-xs font-semibold text-[#374151]">{item.label}</div>
              </div>
            ))}
          </div>

          <button
            onClick={next}
            className="w-full bg-[#5B4FFF] text-white text-base font-semibold py-4 rounded-2xl flex items-center justify-center gap-2 hover:bg-[#4B3FE5] transition-all hover:shadow-lg hover:shadow-[#5B4FFF]/30 active:scale-[0.98]"
          >
            Get Started <ArrowRight className="h-5 w-5" />
          </button>
        </div>
      </div>
    );
  }

  // ─── SETUP ANIMATION ─────────────────────────────────────────────────────────
  if (step === 'setup') {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6">
        <div className="max-w-md w-full text-center">
          <div className="w-16 h-16 rounded-2xl bg-[#5B4FFF] flex items-center justify-center mx-auto mb-8">
            <Bot className="h-8 w-8 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-[#1A1A1A] mb-2">Setting up your AI Revenue Team</h2>
          <p className="text-[#6B7280] mb-10">This will take just a moment...</p>

          <div className="space-y-3 text-left mb-10">
            {setupItems.map((item, i) => (
              <div
                key={item.label}
                className={`flex items-center gap-3 p-4 rounded-xl border transition-all duration-500 ${
                  item.done
                    ? 'bg-[#F0FDF4] border-[#86EFAC]'
                    : i === setupItems.findIndex(x => !x.done)
                    ? 'bg-[#F8F7FF] border-[#5B4FFF]/30 animate-pulse'
                    : 'bg-[#FAFAFA] border-[#E5E7EB] opacity-40'
                }`}
              >
                <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${item.done ? 'bg-[#22C55E]' : 'bg-[#E5E7EB]'}`}>
                  {item.done && <Check className="h-3.5 w-3.5 text-white" />}
                </div>
                <span className={`text-sm font-medium ${item.done ? 'text-[#166534]' : 'text-[#374151]'}`}>{item.label}</span>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3">
            {[
              { name: 'Retention Agent', desc: 'Keeps customers coming back' },
              { name: 'Revenue Agent', desc: 'Finds repeat purchase opportunities' },
            ].map(agent => (
              <div key={agent.name} className="bg-[#FAFAFA] border border-[#E5E7EB] rounded-xl p-4 text-left">
                <div className="w-8 h-8 bg-[#5B4FFF] rounded-lg mb-3 flex items-center justify-center">
                  <Sparkles className="h-4 w-4 text-white" />
                </div>
                <div className="text-sm font-bold text-[#1A1A1A]">{agent.name}</div>
                <div className="text-xs text-[#6B7280] mt-0.5">{agent.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ─── STEP WRAPPER ─────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Progress Bar */}
      <div className="w-full h-1 bg-[#F3F4F6]">
        <div
          className="h-full bg-[#5B4FFF] transition-all duration-500"
          style={{ width: `${((stepIndex) / (steps.length - 1)) * 100}%` }}
        />
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-2xl">

          {/* Back button */}
          {stepIndex > 0 && (
            <button onClick={back} className="flex items-center gap-1.5 text-sm text-[#6B7280] hover:text-[#1A1A1A] mb-8 transition-colors">
              <ArrowLeft className="h-4 w-4" /> Back
            </button>
          )}

          {/* ── INDUSTRY ── */}
          {step === 'industry' && (
            <div>
              <div className="mb-8">
                <p className="text-sm font-semibold text-[#5B4FFF] mb-2">Step 1 of 4</p>
                <h2 className="text-3xl font-black text-[#1A1A1A] mb-2">What industry are you in?</h2>
                <p className="text-[#6B7280]">This helps Xeno tailor its AI models to your specific market.</p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-8">
                {INDUSTRIES.map(ind => {
                  const Icon = ind.icon;
                  const selected = industry === ind.value;
                  return (
                    <button
                      key={ind.value}
                      onClick={() => setIndustry(ind.value)}
                      className={`relative p-5 rounded-2xl border-2 text-left transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] ${
                        selected
                          ? 'border-[#5B4FFF] bg-[#F8F7FF] shadow-md shadow-[#5B4FFF]/10'
                          : 'border-[#E5E7EB] bg-white hover:border-[#5B4FFF]/40'
                      }`}
                    >
                      {selected && (
                        <div className="absolute top-3 right-3 w-5 h-5 bg-[#5B4FFF] rounded-full flex items-center justify-center">
                          <Check className="h-3 w-3 text-white" />
                        </div>
                      )}
                      <div className="w-10 h-10 rounded-xl mb-3 flex items-center justify-center" style={{ backgroundColor: `${ind.color}18` }}>
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
                className="w-full bg-[#5B4FFF] text-white text-base font-semibold py-4 rounded-2xl flex items-center justify-center gap-2 hover:bg-[#4B3FE5] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Continue <ArrowRight className="h-5 w-5" />
              </button>
            </div>
          )}

          {/* ── DATA UPLOAD ── */}
          {step === 'data' && (
            <div>
              <div className="mb-8">
                <p className="text-sm font-semibold text-[#5B4FFF] mb-2">Step 2 of 4</p>
                <h2 className="text-3xl font-black text-[#1A1A1A] mb-2">Connect your customer data</h2>
                <p className="text-[#6B7280]">Upload your customers and orders as CSV files. Xeno will analyze them instantly.</p>
              </div>

              <div className="space-y-4 mb-6">
                {/* Customer CSV */}
                <div
                  onClick={() => customerInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-2xl p-6 cursor-pointer transition-all hover:border-[#5B4FFF]/50 hover:bg-[#F8F7FF] ${
                    customerFile ? 'border-[#5B4FFF] bg-[#F8F7FF]' : 'border-[#E5E7EB]'
                  }`}
                >
                  <input
                    ref={customerInputRef}
                    type="file"
                    accept=".csv"
                    className="hidden"
                    onChange={e => setCustomerFile(e.target.files?.[0] || null)}
                  />
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${customerFile ? 'bg-[#5B4FFF]' : 'bg-[#F3F4F6]'}`}>
                      {customerFile ? <Check className="h-6 w-6 text-white" /> : <UploadCloud className="h-6 w-6 text-[#9CA3AF]" />}
                    </div>
                    <div>
                      <div className="font-bold text-[#1A1A1A]">
                        {customerFile ? customerFile.name : 'Upload Customers CSV'}
                      </div>
                      <div className="text-sm text-[#6B7280]">customer_id, name, email, phone, city...</div>
                    </div>
                  </div>
                </div>

                {/* Orders CSV */}
                <div
                  onClick={() => orderInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-2xl p-6 cursor-pointer transition-all hover:border-[#5B4FFF]/50 hover:bg-[#F8F7FF] ${
                    orderFile ? 'border-[#5B4FFF] bg-[#F8F7FF]' : 'border-[#E5E7EB]'
                  }`}
                >
                  <input
                    ref={orderInputRef}
                    type="file"
                    accept=".csv"
                    className="hidden"
                    onChange={e => setOrderFile(e.target.files?.[0] || null)}
                  />
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${orderFile ? 'bg-[#5B4FFF]' : 'bg-[#F3F4F6]'}`}>
                      {orderFile ? <Check className="h-6 w-6 text-white" /> : <UploadCloud className="h-6 w-6 text-[#9CA3AF]" />}
                    </div>
                    <div>
                      <div className="font-bold text-[#1A1A1A]">
                        {orderFile ? orderFile.name : 'Upload Orders CSV'}
                      </div>
                      <div className="text-sm text-[#6B7280]">order_id, customer_id, date, amount, product...</div>
                    </div>
                  </div>
                </div>
              </div>

              {uploadError && (
                <p className="text-sm text-red-500 mb-4">{uploadError}</p>
              )}

              <button
                onClick={handleDataUpload}
                disabled={!customerFile || !orderFile || uploading}
                className="w-full bg-[#5B4FFF] text-white text-base font-semibold py-4 rounded-2xl flex items-center justify-center gap-2 hover:bg-[#4B3FE5] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {uploading ? (
                  <>
                    <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>Upload & Continue <ArrowRight className="h-5 w-5" /></>
                )}
              </button>
            </div>
          )}

          {/* ── PRIMARY GOAL ── */}
          {step === 'goal' && (
            <div>
              <div className="mb-8">
                <p className="text-sm font-semibold text-[#5B4FFF] mb-2">Step 3 of 4</p>
                <h2 className="text-3xl font-black text-[#1A1A1A] mb-2">What's your primary growth goal?</h2>
                <p className="text-[#6B7280]">Xeno will optimize every decision around this objective.</p>
              </div>

              <div className="grid grid-cols-1 gap-3 mb-8">
                {GOALS.map(g => {
                  const Icon = g.icon;
                  const selected = goal === g.value;
                  return (
                    <button
                      key={g.value}
                      onClick={() => setGoal(g.value)}
                      className={`flex items-center gap-4 p-5 rounded-2xl border-2 text-left transition-all duration-200 hover:scale-[1.01] active:scale-[0.99] ${
                        selected
                          ? 'border-[#5B4FFF] bg-[#F8F7FF] shadow-md shadow-[#5B4FFF]/10'
                          : 'border-[#E5E7EB] bg-white hover:border-[#5B4FFF]/40'
                      }`}
                    >
                      <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${g.color}18` }}>
                        <Icon className="h-6 w-6" style={{ color: g.color }} />
                      </div>
                      <span className="text-base font-bold text-[#1A1A1A]">{g.label}</span>
                      {selected && (
                        <div className="ml-auto w-6 h-6 bg-[#5B4FFF] rounded-full flex items-center justify-center">
                          <Check className="h-3.5 w-3.5 text-white" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>

              <button
                onClick={next}
                disabled={!goal}
                className="w-full bg-[#5B4FFF] text-white text-base font-semibold py-4 rounded-2xl flex items-center justify-center gap-2 hover:bg-[#4B3FE5] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Continue <ArrowRight className="h-5 w-5" />
              </button>
            </div>
          )}

          {/* ── AI MODE ── */}
          {step === 'mode' && (
            <div>
              <div className="mb-8">
                <p className="text-sm font-semibold text-[#5B4FFF] mb-2">Step 4 of 4</p>
                <h2 className="text-3xl font-black text-[#1A1A1A] mb-2">How should Xeno work?</h2>
                <p className="text-[#6B7280]">Choose how much autonomy you give your AI team. You can always change this later.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
                {/* Operator */}
                <button
                  onClick={() => setMode('operator')}
                  className={`p-6 rounded-2xl border-2 text-left transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] ${
                    mode === 'operator'
                      ? 'border-[#5B4FFF] bg-[#F8F7FF] shadow-md shadow-[#5B4FFF]/10'
                      : 'border-[#E5E7EB] bg-white hover:border-[#5B4FFF]/40'
                  }`}
                >
                  <div className="w-12 h-12 rounded-xl bg-[#FEF3C7] flex items-center justify-center mb-4">
                    <ShieldCheck className="h-6 w-6 text-[#D97706]" />
                  </div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-base font-black text-[#1A1A1A]">Operator</span>
                    {mode === 'operator' && (
                      <div className="w-5 h-5 bg-[#5B4FFF] rounded-full flex items-center justify-center">
                        <Check className="h-3 w-3 text-white" />
                      </div>
                    )}
                  </div>
                  <p className="text-sm text-[#6B7280] leading-relaxed">
                    Xeno discovers opportunities, builds audiences, and drafts campaigns.<br />
                    <span className="font-semibold text-[#374151]">You approve before launch.</span>
                  </p>
                </button>

                {/* Autonomous */}
                <button
                  onClick={() => setMode('autonomous')}
                  className={`p-6 rounded-2xl border-2 text-left transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] ${
                    mode === 'autonomous'
                      ? 'border-[#5B4FFF] bg-[#F8F7FF] shadow-md shadow-[#5B4FFF]/10'
                      : 'border-[#E5E7EB] bg-white hover:border-[#5B4FFF]/40'
                  }`}
                >
                  <div className="w-12 h-12 rounded-xl bg-[#F0EEFF] flex items-center justify-center mb-4">
                    <Zap className="h-6 w-6 text-[#5B4FFF]" />
                  </div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-base font-black text-[#1A1A1A]">Autonomous</span>
                    {mode === 'autonomous' && (
                      <div className="w-5 h-5 bg-[#5B4FFF] rounded-full flex items-center justify-center">
                        <Check className="h-3 w-3 text-white" />
                      </div>
                    )}
                  </div>
                  <p className="text-sm text-[#6B7280] leading-relaxed">
                    Xeno discovers opportunities, creates campaigns, and launches automatically.<br />
                    <span className="font-semibold text-[#374151]">Full autopilot.</span>
                  </p>
                </button>
              </div>

              <button
                onClick={handleFinish}
                className="w-full bg-[#5B4FFF] text-white text-base font-semibold py-4 rounded-2xl flex items-center justify-center gap-2 hover:bg-[#4B3FE5] transition-all hover:shadow-lg hover:shadow-[#5B4FFF]/30 active:scale-[0.98]"
              >
                Launch my AI Team <Zap className="h-5 w-5" />
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

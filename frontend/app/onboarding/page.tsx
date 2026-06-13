'use client';

import Image from 'next/image';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  ArrowRight,
  BadgeIndianRupee,
  Check,
  ChevronRight,
  HeartHandshake,
  Home,
  Mail,
  MessageCircle,
  PackageOpen,
  Radio,
  RefreshCcw,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Store,
  Target,
  TrendingUp,
  UploadCloud,
  Users,
  WandSparkles,
  Zap,
} from 'lucide-react';
import {
  getIngestionStatus,
  saveBusinessInfo,
  saveOnboardingProfile,
  startIngestion,
  uploadCustomerCSV,
  uploadOrderCSV,
} from '@/lib/api';

type Screen =
  | 'welcome'
  | 'business'
  | 'connect'
  | 'connected'
  | 'clarify'
  | 'guardrails'
  | 'planning';

type IndustryOption = {
  label: string;
  value: string;
  description: string;
  icon: typeof ShoppingBag;
};

type Question = {
  id: keyof StrategyAnswers;
  title: string;
  helper: string;
  options: string[];
  multi?: boolean;
};

type StrategyAnswers = {
  priority: string[];
  audience: string[];
  engagement: string[];
  channels: string[];
  involvement: string[];
};

type Guardrails = {
  budget: string;
  allowedChannels: string[];
};

const screens: Screen[] = [
  'welcome',
  'business',
  'connect',
  'connected',
  'clarify',
  'guardrails',
  'planning',
];

const industryOptions: IndustryOption[] = [
  {
    label: 'Fashion & Apparel',
    value: 'Fashion',
    description: 'Collections, repeat buyers, seasonal drops',
    icon: ShoppingBag,
  },
  {
    label: 'Beauty & Cosmetics',
    value: 'Beauty',
    description: 'Replenishment, bundles, loyalty journeys',
    icon: Sparkles,
  },
  {
    label: 'Food & Beverage',
    value: 'Food & Beverage',
    description: 'Store visits, repeat orders, local offers',
    icon: Store,
  },
  {
    label: 'Home & Living',
    value: 'Home & Living',
    description: 'Room-based discovery and cross-sell',
    icon: Home,
  },
  {
    label: 'Electronics',
    value: 'Electronics',
    description: 'Accessories, warranties, upgrade cycles',
    icon: Radio,
  },
  {
    label: 'D2C Brand',
    value: 'D2C Brand',
    description: 'Use a flexible growth playbook',
    icon: WandSparkles,
  },
];

const questions: Question[] = [
  {
    id: 'priority',
    title: "What's the most important outcome you want in the next 90 days?",
    helper: 'This decides what growth agents optimize for first.',
    options: [
      'Increase Repeat Purchases',
      'Reduce Customer Churn',
      'Grow Loyalty Engagement',
      'Increase Average Order Value',
      'Drive Store Visits',
    ],
  },
  {
    id: 'audience',
    title: 'How would you like opportunities prioritized?',
    helper: 'AI will identify the best opportunities based on your preference.',
    options: [
      'Highest Revenue Potential',
      'Fastest Wins',
      'Customer Retention',
      'Balanced Mix',
    ],
  },
  {
    id: 'engagement',
    title: 'What type of opportunities should I look for?',
    helper: 'AI will focus on finding these types of growth opportunities.',
    options: [
      'Cross-sell opportunities',
      'Win-back opportunities',
      'Loyalty growth opportunities',
      'High-value customer expansion',
      'All of the above',
    ],
  },
  {
    id: 'channels',
    title: 'Where can I reach your customers?',
    helper: 'Select all channels available to you.',
    options: ['WhatsApp', 'Email', 'SMS', 'RCS'],
    multi: true,
  },
  {
    id: 'involvement',
    title: 'How should your AI team operate?',
    helper: 'You can change this anytime in settings.',
    options: [
      'Advisor — Finds opportunities and suggests actions',
      'Operator — Creates campaigns for approval',
      'Autonomous — Executes within approved guardrails',
    ],
  },
];

const defaultAnswers: StrategyAnswers = {
  priority: [],
  audience: [],
  engagement: [],
  channels: ['WhatsApp', 'Email'],
  involvement: [],
};

const defaultGuardrails: Guardrails = {
  budget: '10000',
  allowedChannels: ['WhatsApp', 'Email'],
};

const modeOptions = [
  {
    id: 'manual',
    title: 'Manual Review',
    description: 'AI creates opportunities and campaigns. You approve every launch.',
    icon: ShieldCheck,
  },
  {
    id: 'autopilot',
    title: 'Autopilot',
    description: 'AI launches within guardrails and asks for approval when risk is high.',
    icon: Zap,
  },
] as const;

const setupSteps = [
  'Learning your growth priorities',
  'Configuring decision-making preferences',
  'Assigning specialized growth agents',
  'Preparing your workspace',
  'Ready',
];

const agents = [
  { name: 'Retention Agent', description: 'Keeps customers coming back', icon: RefreshCcw },
  { name: 'Revenue Agent', description: 'Finds repeat purchase opportunities', icon: BadgeIndianRupee },
  { name: 'Loyalty Agent', description: 'Strengthens customer relationships', icon: HeartHandshake },
  { name: 'Expansion Agent', description: 'Identifies cross-sell opportunities', icon: TrendingUp },
];

function formatNumber(value?: number) {
  return typeof value === 'number' ? value.toLocaleString('en-IN') : '0';
}

function monthsOfHistory(dateRange?: { start: string; end: string } | null) {
  if (!dateRange?.start || !dateRange?.end) return 'Ready';

  const start = new Date(`${dateRange.start}-01`);
  const end = new Date(`${dateRange.end}-01`);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return 'Ready';
  }

  const months =
    (end.getFullYear() - start.getFullYear()) * 12 +
    end.getMonth() -
    start.getMonth() +
    1;

  return `${Math.max(months, 1)} Months`;
}

function optionIsSelected(values: string[], value: string) {
  return values.includes(value);
}

export default function OnboardingPage() {
  const router = useRouter();
  const [screen, setScreen] = useState<Screen>('welcome');
  const [businessName, setBusinessName] = useState('');
  const [industry, setIndustry] = useState<IndustryOption | null>(null);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [customerFile, setCustomerFile] = useState<File | null>(null);
  const [orderFile, setOrderFile] = useState<File | null>(null);
  const [customerPreview, setCustomerPreview] = useState<{
    totalCustomers: number;
    columns: string[];
  } | null>(null);
  const [ordersPreview, setOrdersPreview] = useState<{
    totalOrders: number;
    dateRange: { start: string; end: string } | null;
  } | null>(null);
  const [answers, setAnswers] = useState<StrategyAnswers>(defaultAnswers);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [mode, setMode] = useState<'manual' | 'autopilot'>('manual');
  const [guardrails, setGuardrails] = useState<Guardrails>(defaultGuardrails);
  const [isUploadingCustomers, setIsUploadingCustomers] = useState(false);
  const [isUploadingOrders, setIsUploadingOrders] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentSetupStep, setCurrentSetupStep] = useState(0);
  const [showSuccessScreen, setShowSuccessScreen] = useState(false);

  const currentScreenIndex = screens.indexOf(screen);
  const progress = ((currentScreenIndex + 1) / screens.length) * 100;
  const currentQuestion = questions[questionIndex];
  const hasData = Boolean(customerFile && orderFile && customerPreview && ordersPreview);
  const inferredMode =
    answers.involvement[0] === 'Autopilot' ? 'autopilot' : ('manual' as 'manual' | 'autopilot');

  const dataStats = useMemo(
    () => [
      {
        label: 'Customers',
        value: formatNumber(customerPreview?.totalCustomers),
        icon: Users,
      },
      {
        label: 'Orders',
        value: formatNumber(ordersPreview?.totalOrders),
        icon: ShoppingBag,
      },
      {
        label: 'History',
        value: monthsOfHistory(ordersPreview?.dateRange),
        icon: TrendingUp,
      },
    ],
    [customerPreview, ordersPreview],
  );

  async function handleCustomerUpload(file: File | null) {
    if (!file) return;
    setError(null);
    setCustomerFile(file);
    setIsUploadingCustomers(true);

    try {
      const result = await uploadCustomerCSV(file);
      setCustomerPreview(result.preview);
    } catch (uploadError) {
      setCustomerFile(null);
      setCustomerPreview(null);
      setError(uploadError instanceof Error ? uploadError.message : 'Failed to upload customers.csv');
    } finally {
      setIsUploadingCustomers(false);
    }
  }

  async function handleOrdersUpload(file: File | null) {
    if (!file) return;
    setError(null);
    setOrderFile(file);
    setIsUploadingOrders(true);

    try {
      const result = await uploadOrderCSV(file);
      setOrdersPreview(result.preview);
    } catch (uploadError) {
      setOrderFile(null);
      setOrdersPreview(null);
      setError(uploadError instanceof Error ? uploadError.message : 'Failed to upload orders.csv');
    } finally {
      setIsUploadingOrders(false);
    }
  }

  function goBack() {
    setError(null);

    if (screen === 'clarify' && questionIndex > 0) {
      setQuestionIndex((value) => value - 1);
      return;
    }

    const previousScreen = screens[Math.max(currentScreenIndex - 1, 0)];
    setScreen(previousScreen);
  }

  async function goNext() {
    setError(null);

    if (screen === 'business') {
      if (!industry) return;

      try {
        const name =
          businessName.trim() ||
          `${industry.label.replace('&', 'and')} Brand`;
        const result = await saveBusinessInfo(name, industry.value);
        const savedCompanyId = result?.data?.id ?? null;

        if (!savedCompanyId) {
          setError('Failed to create company. Please try again.');
          return;
        }

        setCompanyId(savedCompanyId);
        window.localStorage.setItem('xeno_company_id', savedCompanyId);
        console.log('Company created with ID:', savedCompanyId);
      } catch (saveError) {
        setError(saveError instanceof Error ? saveError.message : 'Failed to save business info');
        return;
      }
    }

    if (screen === 'connect' && !hasData) return;

    if (screen === 'clarify') {
      if (answers[currentQuestion.id].length === 0) return;

      if (questionIndex < questions.length - 1) {
        setQuestionIndex((value) => value + 1);
        return;
      }

      // Infer mode from involvement answer
      const involvement = answers.involvement[0] || '';
      let inferredOperatingMode: 'manual' | 'autopilot' = 'manual';

      if (involvement.toLowerCase().includes('autonomous')) {
        inferredOperatingMode = 'autopilot';
      } else if (involvement.toLowerCase().includes('operator')) {
        inferredOperatingMode = 'manual';
      } else if (involvement.toLowerCase().includes('advisor')) {
        inferredOperatingMode = 'manual';
      }

      setMode(inferredOperatingMode);

      // Update guardrails with selected channels
      setGuardrails((current) => ({
        ...current,
        allowedChannels: answers.channels.length > 0 ? answers.channels : current.allowedChannels,
      }));
    }

    if (screen === 'guardrails') {
      await persistProfileAndStart();
      return;
    }

    const nextScreen = screens[Math.min(currentScreenIndex + 1, screens.length - 1)];
    setScreen(nextScreen);
  }

  async function persistProfileAndStart() {
    if (!customerFile || !orderFile) return;
    const resolvedCompanyId = companyId ?? window.localStorage.getItem('xeno_company_id');

    if (!resolvedCompanyId) {
      setError('Company ID not found. Please go back and complete the business step.');
      return;
    }

    console.log('Saving profile for company:', resolvedCompanyId);

    const companyName =
      businessName.trim() || `${industry?.label ?? 'Brand'} Brand`;
    const profile = {
      companyName,
      industry: industry?.value ?? null,
      operatingMode: mode,
      strategy: answers,
      guardrails,
      dataSummary: {
        totalCustomers: customerPreview?.totalCustomers ?? 0,
        totalOrders: ordersPreview?.totalOrders ?? 0,
        historyRange: ordersPreview?.dateRange ?? null,
      },
      fileNames: {
        customers: customerFile.name,
        orders: orderFile.name,
      },
    };

    try {
      await saveOnboardingProfile(resolvedCompanyId, profile);
    } catch (profileError) {
      setError(
        profileError instanceof Error
          ? profileError.message
          : 'Failed to save onboarding profile',
      );
      return;
    }

    await startProcessing();
  }

  async function startProcessing() {
    if (!customerFile || !orderFile) return;

    setIsProcessing(true);
    setScreen('planning');
    setCurrentSetupStep(0);

    // Animate through setup steps
    const stepInterval = window.setInterval(() => {
      setCurrentSetupStep((prev) => {
        if (prev < setupSteps.length - 1) {
          return prev + 1;
        }
        window.clearInterval(stepInterval);
        return prev;
      });
    }, 1200); // Each step takes 1.2 seconds

    try {
      const result = await startIngestion(customerFile, orderFile);
      const sessionId = result.sessionId;

      const pollInterval = window.setInterval(async () => {
        try {
          const status = await getIngestionStatus(sessionId);

          if (status.step === 'completed') {
            window.clearInterval(pollInterval);
            window.clearInterval(stepInterval);

            // Show all steps as complete
            setCurrentSetupStep(setupSteps.length - 1);

            // Wait a bit, then show success screen
            window.setTimeout(() => {
              setShowSuccessScreen(true);

              // After success screen, redirect
              window.setTimeout(() => {
                router.push('/opportunities');
              }, 3000);
            }, 800);
          } else if (status.step === 'error') {
            window.clearInterval(pollInterval);
            window.clearInterval(stepInterval);
            setError(`Ingestion failed: ${status.message}`);
            setIsProcessing(false);
            setScreen('guardrails');
          }
        } catch (pollError) {
          window.clearInterval(pollInterval);
          window.clearInterval(stepInterval);
          setError(pollError instanceof Error ? pollError.message : 'Failed to check ingestion status');
          setIsProcessing(false);
          setScreen('guardrails');
        }
      }, 1000);
    } catch (processingError) {
      setError(processingError instanceof Error ? processingError.message : 'Failed to start ingestion');
      setIsProcessing(false);
      setScreen('guardrails');
    }
  }

  function toggleAnswer(question: Question, value: string) {
    setAnswers((current) => {
      const existing = current[question.id];

      if (question.multi) {
        return {
          ...current,
          [question.id]: optionIsSelected(existing, value)
            ? existing.filter((item) => item !== value)
            : [...existing, value],
        };
      }

      return {
        ...current,
        [question.id]: [value],
      };
    });
  }


  function canContinue() {
    if (screen === 'business') return Boolean(industry);
    if (screen === 'connect') return hasData && !isUploadingCustomers && !isUploadingOrders;
    if (screen === 'clarify') return answers[currentQuestion.id].length > 0;
    if (screen === 'guardrails') return !isProcessing;
    if (screen === 'planning') return false;
    return true;
  }

  return (
    <main className="min-h-screen bg-white text-[#1A1A1A]">
      <div className="fixed left-0 right-0 top-0 z-20 h-1 bg-[#F4F4F5]">
        <div
          className="h-full bg-[#5B4FFF] transition-all duration-500 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-5 py-7">
        <header className="flex items-center justify-between">
          <div className="relative h-[30px] w-[132px]">
            <Image src="/logo.png" alt="Xeno" fill priority sizes="132px" className="object-contain object-left" />
          </div>

          <div className="text-xs font-medium text-[#A1A1AA]">
            Step {currentScreenIndex + 1} of {screens.length}
          </div>
        </header>

        <section className="flex flex-1 items-center justify-center py-10">
          <div className="w-full">
            {error && (
              <div className="mx-auto mb-6 max-w-2xl rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                {error}
              </div>
            )}

            {screen === 'welcome' && (
              <CenteredPanel>
                <div className="mx-auto mb-8 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#F0EEFF] text-[#5B4FFF]">
                  <Sparkles className="h-7 w-7" />
                </div>
                <h1 className="text-4xl font-bold tracking-normal text-[#1A1A1A]">
                  Welcome to Growth Copilot
                </h1>
                <p className="mt-3 text-lg font-medium text-[#71717A]">
                  Let&apos;s build your AI growth team.
                </p>
                <button
                  onClick={goNext}
                  className="mt-10 inline-flex h-11 items-center justify-center rounded-lg bg-[#5B4FFF] px-6 text-sm font-semibold text-white transition hover:bg-[#4B3FE5]"
                >
                  Get Started
                  <ArrowRight className="ml-2 h-4 w-4" />
                </button>
              </CenteredPanel>
            )}

            {screen === 'business' && (
              <CenteredPanel wide>
                <ScreenTitle
                  eyebrow=""
                  title="What best describes your business?"
                  subtitle="I will tailor opportunities, campaigns, and customer journeys to your category."
                />

                <div className="mx-auto mt-8 grid max-w-4xl grid-cols-1 gap-3 md:grid-cols-2">
                  {industryOptions.map((option) => {
                    const Icon = option.icon;
                    const active = industry?.value === option.value;

                    return (
                      <button
                        key={option.value}
                        onClick={() => setIndustry(option)}
                        className={`group flex min-h-[92px] items-center gap-4 rounded-lg border bg-white p-4 text-left transition ${
                          active
                            ? 'border-[#5B4FFF] shadow-[0_0_0_3px_rgba(91,79,255,0.12)]'
                            : 'border-[#E4E4E7] hover:border-[#A1A1AA] hover:bg-[#FAFAFA]'
                        }`}
                      >
                        <div
                          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${
                            active ? 'bg-[#5B4FFF] text-white' : 'bg-[#F4F4F5] text-[#71717A]'
                          }`}
                        >
                          <Icon className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-[#1A1A1A]">{option.label}</div>
                          <div className="mt-1 text-sm text-[#71717A]">{option.description}</div>
                        </div>
                        {active && <Check className="ml-auto h-5 w-5 shrink-0 text-[#5B4FFF]" />}
                      </button>
                    );
                  })}
                </div>

                {industry && (
                  <div className="mx-auto mt-6 max-w-xl rounded-lg border border-[#E4E4E7] bg-[#FAFAFA] px-4 py-3 text-sm text-[#71717A]">
                    <span className="font-semibold text-[#1A1A1A]">Great.</span> I&apos;ll tailor
                    opportunities, campaigns, and journeys for {industry.label}.
                  </div>
                )}
              </CenteredPanel>
            )}

            {screen === 'connect' && (
              <CenteredPanel wide>
                <ScreenTitle
                  eyebrow="Connect data"
                  title="Upload customer and order data"
                  subtitle="Growth Copilot needs customers.csv and orders.csv to build real opportunities."
                />

                <div className="mx-auto mt-8 grid max-w-4xl gap-4 md:grid-cols-2">
                  <UploadCard
                    title="Customer Records"
                    description="customers.csv"
                    file={customerFile}
                    isLoading={isUploadingCustomers}
                    metric={customerPreview ? `${formatNumber(customerPreview.totalCustomers)} customers` : null}
                    onFile={handleCustomerUpload}
                  />
                  <UploadCard
                    title="Purchase History"
                    description="orders.csv"
                    file={orderFile}
                    isLoading={isUploadingOrders}
                    metric={ordersPreview ? `${formatNumber(ordersPreview.totalOrders)} orders` : null}
                    onFile={handleOrdersUpload}
                  />
                </div>
              </CenteredPanel>
            )}

            {screen === 'connected' && (
              <CenteredPanel>
                <div className="mx-auto mb-8 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                  <Check className="h-7 w-7" />
                </div>
                <h1 className="text-3xl font-bold tracking-normal">I&apos;ve analyzed your customer data.</h1>
                <div className="mx-auto mt-8 grid max-w-2xl grid-cols-1 gap-3 sm:grid-cols-3">
                  {dataStats.map((stat) => {
                    const Icon = stat.icon;
                    return (
                      <div key={stat.label} className="rounded-lg border border-[#E4E4E7] bg-white p-4">
                        <Icon className="mx-auto h-5 w-5 text-[#5B4FFF]" />
                        <div className="mt-3 text-xl font-bold">{stat.value}</div>
                        <div className="mt-1 text-xs font-medium text-[#71717A]">{stat.label}</div>
                      </div>
                    );
                  })}
                </div>
                <p className="mt-8 text-lg font-medium text-[#71717A]">
                  I have enough data to build your growth strategy.
                </p>
              </CenteredPanel>
            )}

            {screen === 'clarify' && (
              <CenteredPanel>
                <div className="mb-5 text-sm font-semibold text-[#5B4FFF]">
                  Question {questionIndex + 1} of {questions.length}
                </div>
                <h1 className="text-3xl font-bold tracking-normal">{currentQuestion.title}</h1>
                <p className="mx-auto mt-3 max-w-xl text-base font-medium text-[#71717A]">
                  {currentQuestion.helper}
                </p>

                <div className="mx-auto mt-8 flex max-w-2xl flex-col gap-3">
                  {currentQuestion.options.map((option) => {
                    const active = optionIsSelected(answers[currentQuestion.id], option);

                    return (
                      <button
                        key={option}
                        onClick={() => toggleAnswer(currentQuestion, option)}
                        className={`flex min-h-14 items-center justify-between rounded-lg border px-4 py-3 text-left transition ${
                          active
                            ? 'border-[#5B4FFF] bg-[#F7F6FF] text-[#1A1A1A]'
                            : 'border-[#E4E4E7] bg-white text-[#1A1A1A] hover:bg-[#FAFAFA]'
                        }`}
                      >
                        <span className="text-sm font-semibold">{option}</span>
                        {active ? (
                          <Check className="h-5 w-5 text-[#5B4FFF]" />
                        ) : (
                          <ChevronRight className="h-5 w-5 text-[#D4D4D8]" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </CenteredPanel>
            )}

            {screen === 'guardrails' && (
              <CenteredPanel>
                <ScreenTitle
                  eyebrow="Budget"
                  title="Set your monthly marketing budget"
                  subtitle="AI will distribute this intelligently across campaigns and channels based on performance."
                />

                <div className="mx-auto mt-10 max-w-md">
                  <div className="flex h-16 items-center rounded-lg border-2 border-[#E4E4E7] bg-white px-6 focus-within:border-[#5B4FFF] focus-within:ring-4 focus-within:ring-[#5B4FFF]/10">
                    <BadgeIndianRupee className="mr-3 h-6 w-6 text-[#71717A]" />
                    <span className="text-lg font-semibold text-[#71717A]">INR</span>
                    <input
                      type="text"
                      value={guardrails.budget}
                      onChange={(event) =>
                        setGuardrails((current) => ({ ...current, budget: event.target.value }))
                      }
                      inputMode="numeric"
                      placeholder="10000"
                      className="ml-3 min-w-0 flex-1 bg-transparent text-lg font-semibold outline-none placeholder:text-[#D4D4D8]"
                    />
                  </div>
                  <p className="mt-4 text-center text-sm text-[#71717A]">
                    You can adjust this anytime in settings
                  </p>
                </div>
              </CenteredPanel>
            )}

            {screen === 'planning' && !showSuccessScreen && (
              <CenteredPanel>
                <div className="mx-auto mb-8 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[#5B4FFF] to-[#7C3AED] shadow-lg shadow-[#5B4FFF]/20">
                  <WandSparkles className="h-8 w-8 animate-pulse text-white" />
                </div>
                <h1 className="text-4xl font-bold tracking-tight">Setting up your AI Revenue Team</h1>
                <p className="mt-3 text-base font-medium text-[#71717A]">
                  This will take just a moment...
                </p>

                {/* Setup Steps */}
                <div className="mx-auto mt-10 max-w-xl space-y-3 text-left">
                  {setupSteps.map((step, index) => {
                    const isComplete = index < currentSetupStep;
                    const isCurrent = index === currentSetupStep;
                    const isPending = index > currentSetupStep;

                    return (
                      <div
                        key={step}
                        className={`flex items-center gap-4 rounded-xl border p-4 transition-all duration-500 ${
                          isComplete
                            ? 'border-emerald-200 bg-emerald-50'
                            : isCurrent
                            ? 'border-[#5B4FFF] bg-[#F7F6FF] shadow-md shadow-[#5B4FFF]/10'
                            : 'border-[#E4E4E7] bg-white opacity-50'
                        }`}
                      >
                        <div
                          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-all duration-500 ${
                            isComplete
                              ? 'bg-emerald-500'
                              : isCurrent
                              ? 'bg-[#5B4FFF] animate-pulse'
                              : 'bg-[#E4E4E7]'
                          }`}
                        >
                          {isComplete ? (
                            <Check className="h-5 w-5 text-white" />
                          ) : isCurrent ? (
                            <div className="h-2 w-2 rounded-full bg-white animate-ping" />
                          ) : (
                            <div className="h-2 w-2 rounded-full bg-[#A1A1AA]" />
                          )}
                        </div>
                        <span
                          className={`text-sm font-semibold transition-colors ${
                            isComplete
                              ? 'text-emerald-700'
                              : isCurrent
                              ? 'text-[#5B4FFF]'
                              : 'text-[#A1A1AA]'
                          }`}
                        >
                          {step}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* AI Team Cards */}
                <div className="mx-auto mt-12">
                  <h2 className="mb-5 text-center text-sm font-semibold uppercase tracking-wide text-[#71717A]">
                    Your AI Team
                  </h2>
                  <div className="grid max-w-3xl grid-cols-1 gap-3 sm:grid-cols-2">
                    {agents.map((agent, index) => {
                      const Icon = agent.icon;
                      return (
                        <div
                          key={agent.name}
                          className="group flex items-start gap-4 rounded-xl border border-[#E4E4E7] bg-white p-4 transition-all hover:border-[#5B4FFF] hover:shadow-md"
                          style={{
                            animation: `fadeInUp 0.5s ease-out ${index * 0.1}s both`,
                          }}
                        >
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[#5B4FFF] to-[#7C3AED] shadow-sm">
                            <Icon className="h-5 w-5 text-white" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <h3 className="text-sm font-bold text-[#1A1A1A]">{agent.name}</h3>
                            <p className="mt-1 text-xs leading-relaxed text-[#71717A]">
                              {agent.description}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </CenteredPanel>
            )}

            {screen === 'planning' && showSuccessScreen && (
              <CenteredPanel>
                <div className="mx-auto mb-8 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-2xl shadow-emerald-500/30 animate-bounce-in">
                  <Check className="h-10 w-10 text-white" strokeWidth={3} />
                </div>

                <h1 className="text-4xl font-bold tracking-tight">Your AI Revenue Team is Ready</h1>
                <p className="mt-4 text-lg font-medium text-[#71717A]">
                  Everything is configured and ready to go
                </p>

                <div className="mx-auto mt-10 max-w-md space-y-3">
                  {[
                    `4 AI Agents Configured`,
                    `${answers.channels.join(' + ')} Enabled`,
                    `Growth Priorities Defined`,
                    `${mode === 'autopilot' ? 'Autonomous' : 'Manual'} Mode Active`,
                  ].map((item, index) => (
                    <div
                      key={item}
                      className="flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3"
                      style={{
                        animation: `fadeInUp 0.3s ease-out ${index * 0.1}s both`,
                      }}
                    >
                      <Check className="h-5 w-5 shrink-0 text-emerald-600" />
                      <span className="text-sm font-semibold text-emerald-900">{item}</span>
                    </div>
                  ))}
                </div>

                <div className="mt-10">
                  <div className="inline-flex items-center gap-2 rounded-full bg-[#F7F6FF] px-4 py-2 text-sm font-medium text-[#5B4FFF]">
                    <Sparkles className="h-4 w-4" />
                    <span>Your first opportunities are waiting...</span>
                  </div>
                </div>
              </CenteredPanel>
            )}
          </div>
        </section>

        {screen !== 'welcome' && screen !== 'planning' && (
          <footer className="mx-auto flex w-full max-w-2xl items-center justify-between pb-4">
            <button
              onClick={goBack}
              disabled={currentScreenIndex === 0 || isProcessing}
              className="inline-flex h-10 items-center rounded-lg px-3 text-sm font-semibold text-[#71717A] transition hover:bg-[#F4F4F5] hover:text-[#1A1A1A] disabled:pointer-events-none disabled:opacity-40"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </button>

            <button
              onClick={goNext}
              disabled={!canContinue()}
              className="inline-flex h-10 items-center rounded-lg bg-[#5B4FFF] px-5 text-sm font-semibold text-white transition hover:bg-[#4B3FE5] disabled:pointer-events-none disabled:opacity-40"
            >
              {screen === 'guardrails' ? 'Create AI Team' : 'Continue'}
              <ArrowRight className="ml-2 h-4 w-4" />
            </button>
          </footer>
        )}
      </div>
    </main>
  );
}

function CenteredPanel({
  children,
  wide = false,
}: {
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div className={`mx-auto text-center ${wide ? 'max-w-5xl' : 'max-w-3xl'}`}>
      {children}
    </div>
  );
}

function ScreenTitle({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
}) {
  return (
    <div>
      {eyebrow && <div className="text-sm font-semibold text-[#5B4FFF]">{eyebrow}</div>}
      <h1 className={`text-3xl font-bold tracking-normal text-[#1A1A1A] ${eyebrow ? 'mt-3' : ''}`}>{title}</h1>
      <p className="mx-auto mt-3 max-w-2xl text-base font-medium text-[#71717A]">{subtitle}</p>
    </div>
  );
}

function UploadCard({
  title,
  description,
  file,
  metric,
  isLoading,
  onFile,
}: {
  title: string;
  description: string;
  file: File | null;
  metric: string | null;
  isLoading: boolean;
  onFile: (file: File | null) => void;
}) {
  return (
    <label className="group flex min-h-[240px] cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-[#D4D4D8] bg-white p-6 text-center transition hover:border-[#5B4FFF] hover:bg-[#FAFAFA]">
      <input
        type="file"
        accept=".csv,text/csv"
        className="sr-only"
        onChange={(event) => onFile(event.target.files?.[0] ?? null)}
      />
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#F0EEFF] text-[#5B4FFF]">
        {file ? <Check className="h-6 w-6" /> : <UploadCloud className="h-6 w-6" />}
      </div>
      <h2 className="mt-5 text-lg font-bold tracking-normal">{title}</h2>
      <p className="mt-1 text-sm font-medium text-[#71717A]">{description}</p>
      <div className="mt-5 rounded-full bg-[#F4F4F5] px-3 py-1 text-xs font-semibold text-[#71717A]">
        {isLoading ? 'Reading file...' : metric ?? 'Choose CSV'}
      </div>
      {file && <p className="mt-3 max-w-full truncate text-xs font-medium text-[#A1A1AA]">{file.name}</p>}
    </label>
  );
}

function GuardrailPanel({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: typeof Mail;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-[#E4E4E7] bg-white p-4 text-left">
      <div className="mb-4 flex items-center gap-2">
        <Icon className="h-4 w-4 text-[#5B4FFF]" />
        <h2 className="text-sm font-bold tracking-normal">{title}</h2>
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function MiniOption({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-h-9 w-full items-center justify-between rounded-md border px-3 py-2 text-left text-xs font-semibold transition ${
        active
          ? 'border-[#5B4FFF] bg-[#F7F6FF] text-[#5B4FFF]'
          : 'border-[#E4E4E7] bg-white text-[#71717A] hover:bg-[#FAFAFA]'
      }`}
    >
      <span>{children}</span>
      {active && <Check className="h-3.5 w-3.5" />}
    </button>
  );
}

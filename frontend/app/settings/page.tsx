'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Check, Save } from 'lucide-react';
import { getCompany, getIntegrations, saveIntegration, saveOnboardingProfile, verifyIntegration, type IntegrationCard } from '@/lib/api';

type OnboardingSettings = {
  companyName: string;
  industry: string;
  priority: string[];
  audience: string[];
  engagement: string[];
  channels: string[];
  involvement: string[];
  budget: string;
};

const industryOptions = [
  'Fashion & Apparel',
  'Beauty & Cosmetics',
  'Food & Beverage',
  'Home & Living',
  'Electronics',
  'D2C Brand',
];

const priorityOptions = [
  'Increase Repeat Purchases',
  'Reduce Customer Churn',
  'Grow Loyalty Engagement',
  'Increase Average Order Value',
  'Drive Store Visits',
];

const audienceOptions = [
  'Highest Revenue Potential',
  'Fastest Wins',
  'Customer Retention',
  'Balanced Mix',
];

const engagementOptions = [
  'Cross-sell opportunities',
  'Win-back opportunities',
  'Loyalty growth opportunities',
  'High-value customer expansion',
  'All of the above',
];

const channelOptions = ['WhatsApp', 'Email', 'SMS', 'RCS'];

const involvementOptions = [
  'Advisor — Finds opportunities and suggests actions',
  'Operator — Creates campaigns for approval',
  'Autonomous — Executes within approved guardrails',
];

export default function SettingsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [settings, setSettings] = useState<OnboardingSettings>({
    companyName: '',
    industry: '',
    priority: [],
    audience: [],
    engagement: [],
    channels: [],
    involvement: [],
    budget: '10000',
  });

  const loadSettings = useCallback(async () => {
    try {
      const data = await getCompany();
      const profile = data.data?.onboarding_profile || {};

      setSettings({
        companyName: data.data?.company_name || '',
        industry: data.data?.industry || '',
        priority: profile.strategy?.priority || [],
        audience: profile.strategy?.audience || [],
        engagement: profile.strategy?.engagement || [],
        channels: profile.strategy?.channels || [],
        involvement: profile.strategy?.involvement || [],
        budget: profile.guardrails?.budget || '10000',
      });

      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load settings');
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  async function handleSave() {
    try {
      setSaving(true);
      setError(null);
      setSuccess(false);

      const profile = {
        companyName: settings.companyName,
        industry: settings.industry,
        strategy: {
          priority: settings.priority,
          audience: settings.audience,
          engagement: settings.engagement,
          channels: settings.channels,
          involvement: settings.involvement,
        },
        guardrails: {
          budget: settings.budget,
          allowedChannels: settings.channels,
        },
      };

      await saveOnboardingProfile(profile);

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  }

  function toggleSelection(key: keyof OnboardingSettings, value: string, multi: boolean = false) {
    setSettings((prev) => {
      const current = prev[key] as string[];

      if (multi) {
        const isSelected = current.includes(value);
        return {
          ...prev,
          [key]: isSelected ? current.filter((v) => v !== value) : [...current, value],
        };
      } else {
        return { ...prev, [key]: [value] };
      }
    });
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#E4E4E7] border-t-[#5B4FFF]"></div>
          <p className="mt-4 text-sm text-[#71717A]">Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAFAFA]">
      <div className="mx-auto max-w-4xl px-6 py-8">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <button
              onClick={() => router.push('/opportunities')}
              className="mb-4 flex items-center gap-2 text-sm font-medium text-[#71717A] transition hover:text-[#1A1A1A]"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Dashboard
            </button>
            <h1 className="text-3xl font-bold text-[#1A1A1A]">Settings</h1>
            <p className="mt-2 text-sm text-[#71717A]">
              Update your preferences and AI team configuration
            </p>
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            className="flex h-10 items-center gap-2 rounded-lg bg-[#5B4FFF] px-5 text-sm font-semibold text-white transition hover:bg-[#4B3FE5] disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>

        {/* Notifications */}
        {error && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-6 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            Settings saved successfully!
          </div>
        )}

        {/* Settings Sections */}
        <div className="space-y-6">
          {/* Business Information */}
          <Section title="Business Information">
            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-semibold text-[#1A1A1A]">
                  Company Name
                </label>
                <input
                  type="text"
                  value={settings.companyName}
                  onChange={(e) => setSettings({ ...settings, companyName: e.target.value })}
                  className="h-11 w-full rounded-lg border border-[#E4E4E7] bg-white px-4 text-sm font-medium outline-none transition focus:border-[#5B4FFF] focus:ring-4 focus:ring-[#5B4FFF]/10"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-[#1A1A1A]">Industry</label>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {industryOptions.map((option) => (
                    <button
                      key={option}
                      onClick={() => setSettings({ ...settings, industry: option })}
                      className={`rounded-lg border px-4 py-2 text-sm font-medium transition ${
                        settings.industry === option
                          ? 'border-[#5B4FFF] bg-[#F7F6FF] text-[#5B4FFF]'
                          : 'border-[#E4E4E7] bg-white text-[#1A1A1A] hover:border-[#A1A1AA]'
                      }`}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </Section>

          {/* Growth Goals */}
          <Section title="What's the most important outcome you want in the next 90 days?">
            <OptionGrid
              options={priorityOptions}
              selected={settings.priority}
              onToggle={(value) => toggleSelection('priority', value)}
            />
          </Section>

          <Section title="How would you like opportunities prioritized?">
            <OptionGrid
              options={audienceOptions}
              selected={settings.audience}
              onToggle={(value) => toggleSelection('audience', value)}
            />
          </Section>

          <Section title="What type of opportunities should I look for?">
            <OptionGrid
              options={engagementOptions}
              selected={settings.engagement}
              onToggle={(value) => toggleSelection('engagement', value)}
            />
          </Section>

          <Section title="Where can I reach your customers?">
            <OptionGrid
              options={channelOptions}
              selected={settings.channels}
              onToggle={(value) => toggleSelection('channels', value, true)}
            />
          </Section>

          <Section title="How should your AI team operate?">
            <div className="space-y-2">
              {involvementOptions.map((option) => (
                <button
                  key={option}
                  onClick={() => toggleSelection('involvement', option)}
                  className={`flex w-full items-center justify-between rounded-lg border px-4 py-3 text-left transition ${
                    settings.involvement.includes(option)
                      ? 'border-[#5B4FFF] bg-[#F7F6FF]'
                      : 'border-[#E4E4E7] bg-white hover:border-[#A1A1AA]'
                  }`}
                >
                  <span className="text-sm font-medium text-[#1A1A1A]">{option}</span>
                  {settings.involvement.includes(option) && (
                    <Check className="h-5 w-5 text-[#5B4FFF]" />
                  )}
                </button>
              ))}
            </div>
          </Section>

          <IntegrationsSection />

          {/* Budget */}
          <Section title="Monthly Marketing Budget">
            <div className="max-w-md">
              <div className="flex h-14 items-center rounded-lg border-2 border-[#E4E4E7] bg-white px-5 focus-within:border-[#5B4FFF] focus-within:ring-4 focus-within:ring-[#5B4FFF]/10">
                <span className="text-base font-semibold text-[#71717A]">INR</span>
                <input
                  type="text"
                  value={settings.budget}
                  onChange={(e) => setSettings({ ...settings, budget: e.target.value })}
                  inputMode="numeric"
                  className="ml-3 min-w-0 flex-1 bg-transparent text-base font-semibold outline-none"
                />
              </div>
            </div>
          </Section>
        </div>

        {/* Save Button (Bottom) */}
        <div className="mt-8 flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex h-11 items-center gap-2 rounded-lg bg-[#5B4FFF] px-6 text-sm font-semibold text-white transition hover:bg-[#4B3FE5] disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

const INTEGRATION_COPY: Record<IntegrationCard['kind'], { title: string; hint: string }> = {
  llm: { title: 'AI model', hint: 'OpenRouter for the planner. Simulator uses the scripted observe tape.' },
  email: { title: 'Email', hint: 'Resend BYOK, or stay on the delivery simulator.' },
  whatsapp: { title: 'WhatsApp / SMS', hint: 'Twilio BYOK, or stay on the delivery simulator.' },
};

function IntegrationsSection() {
  const [cards, setCards] = useState<IntegrationCard[]>([]);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [draftKeys, setDraftKeys] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    getIntegrations()
      .then((res) => {
        setAvailable(res.available !== false);
        setCards(res.data ?? []);
      })
      .catch(() => {
        setAvailable(false);
        setCards([]);
      });
  }, []);

  async function save(kind: IntegrationCard['kind'], mode: 'simulator' | 'byok') {
    setBusy(`${kind}:${mode}`);
    setNote(null);
    try {
      const res = await saveIntegration(kind, {
        mode,
        apiKey: mode === 'byok' ? draftKeys[kind] : undefined,
      });
      setCards((prev) => prev.map((c) => (c.kind === kind ? res.data : c)));
      setNote(mode === 'simulator' ? 'Simulator is on. No tenant key is stored.' : 'Key stored encrypted.');
    } catch (err) {
      setNote(err instanceof Error ? err.message : 'Failed to save integration');
    } finally {
      setBusy(null);
    }
  }

  async function verify(kind: IntegrationCard['kind']) {
    setBusy(`${kind}:verify`);
    setNote(null);
    try {
      const res = await verifyIntegration(kind);
      setCards((prev) => prev.map((c) => (c.kind === kind ? res.data : c)));
      setNote('Verified.');
    } catch (err) {
      setNote(err instanceof Error ? err.message : 'Verify failed');
    } finally {
      setBusy(null);
    }
  }

  return (
    <Section title="Integrations">
      <p className="mb-4 text-sm text-[#71717A]">
        Simulator is the default. Real sends use your own keys (AES-256-GCM, never returned).
      </p>
      {available === false && (
        <p className="mb-4 text-sm text-[#71717A]">
          Integration tables are not applied yet. Cards still default to simulator.
        </p>
      )}
      {note && <p className="mb-4 text-sm text-[#5B4FFF]">{note}</p>}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {(cards.length > 0 ? cards : (['llm', 'email', 'whatsapp'] as const).map((kind) => ({
          kind,
          provider: kind === 'llm' ? 'openrouter' : kind === 'email' ? 'resend' : 'twilio',
          mode: 'simulator',
          status: 'unconfigured',
          maskedKey: null,
          lastVerifiedAt: null,
        }))).map((card) => {
          const copy = INTEGRATION_COPY[card.kind];
          return (
            <div key={card.kind} className="rounded-lg border border-[#E4E4E7] p-4">
              <h3 className="text-sm font-semibold text-[#1A1A1A]">{copy.title}</h3>
              <p className="mt-1 text-xs text-[#71717A]">{copy.hint}</p>
              <p className="mt-3 text-xs font-medium text-[#1A1A1A]">
                Mode: {card.mode} · {card.status}
              </p>
              {card.maskedKey && (
                <p className="mt-1 font-mono text-xs text-[#71717A]">{card.maskedKey}</p>
              )}
              <input
                type="password"
                placeholder="Paste key only for BYOK"
                value={draftKeys[card.kind] ?? ''}
                onChange={(e) => setDraftKeys((prev) => ({ ...prev, [card.kind]: e.target.value }))}
                className="mt-3 h-9 w-full rounded-md border border-[#E4E4E7] px-2 text-xs"
              />
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() => save(card.kind, 'simulator')}
                  className="rounded-md border border-[#E4E4E7] px-2 py-1 text-xs"
                >
                  Try simulator
                </button>
                <button
                  type="button"
                  disabled={busy !== null || !(draftKeys[card.kind] ?? '').trim()}
                  onClick={() => save(card.kind, 'byok')}
                  className="rounded-md bg-[#5B4FFF] px-2 py-1 text-xs text-white disabled:opacity-40"
                >
                  Save key
                </button>
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() => verify(card.kind)}
                  className="rounded-md border border-[#E4E4E7] px-2 py-1 text-xs"
                >
                  Verify
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </Section>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-[#E4E4E7] bg-white p-6">
      <h2 className="mb-4 text-lg font-bold text-[#1A1A1A]">{title}</h2>
      {children}
    </div>
  );
}

function OptionGrid({
  options,
  selected,
  onToggle,
}: {
  options: string[];
  selected: string[];
  onToggle: (value: string) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {options.map((option) => {
        const isSelected = selected.includes(option);

        return (
          <button
            key={option}
            onClick={() => onToggle(option)}
            className={`flex items-center justify-between rounded-lg border px-4 py-3 text-left transition ${
              isSelected
                ? 'border-[#5B4FFF] bg-[#F7F6FF]'
                : 'border-[#E4E4E7] bg-white hover:border-[#A1A1AA]'
            }`}
          >
            <span className="text-sm font-medium text-[#1A1A1A]">{option}</span>
            {isSelected && <Check className="h-5 w-5 shrink-0 text-[#5B4FFF]" />}
          </button>
        );
      })}
    </div>
  );
}

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { BotAvatar } from 'bot-avatars';
import { Check, Loader2, Save } from 'lucide-react';
import {
  getCompany,
  getIntegrations,
  saveIntegration,
  saveOnboardingProfile,
  verifyIntegration,
  getBillingStatus,
  createBillingCheckout,
  type IntegrationCard,
  type BillingStatus,
} from '@/lib/api';
import { ConsoleCard } from '@/components/campaign/console';
import { StatePanel, statePanelActionClass } from '@/components/ui/state-panel';
import { cn } from '@/lib/utils';

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

const SAVED_NOTICE_MS = 3000;

const TABS = [
  { id: 'workspace', label: 'Workspace' },
  { id: 'agent', label: 'Agent behaviour' },
  { id: 'connections', label: 'Connections and plan' },
] as const;
type TabId = (typeof TABS)[number]['id'];

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

const audienceOptions = ['Highest Revenue Potential', 'Fastest Wins', 'Customer Retention', 'Balanced Mix'];

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

const EMPTY_SETTINGS: OnboardingSettings = {
  companyName: '',
  industry: '',
  priority: [],
  audience: [],
  engagement: [],
  channels: [],
  involvement: [],
  budget: '10000',
};

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [tab, setTab] = useState<TabId>('workspace');
  const [settings, setSettings] = useState<OnboardingSettings>(EMPTY_SETTINGS);
  const [saved, setSaved] = useState<OnboardingSettings>(EMPTY_SETTINGS);

  const loadSettings = useCallback(async () => {
    setLoadError(null);
    try {
      const data = await getCompany();
      const profile = data.data?.onboarding_profile || {};
      const next: OnboardingSettings = {
        companyName: data.data?.company_name || '',
        industry: data.data?.industry || '',
        priority: profile.strategy?.priority || [],
        audience: profile.strategy?.audience || [],
        engagement: profile.strategy?.engagement || [],
        channels: profile.strategy?.channels || [],
        involvement: profile.strategy?.involvement || [],
        budget: profile.guardrails?.budget || EMPTY_SETTINGS.budget,
      };
      setSettings(next);
      setSaved(next);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  const dirty = useMemo(() => JSON.stringify(settings) !== JSON.stringify(saved), [settings, saved]);

  async function handleSave() {
    try {
      setSaving(true);
      setError(null);
      setSuccess(false);

      await saveOnboardingProfile({
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
      });

      setSaved(settings);
      setSuccess(true);
      setTimeout(() => setSuccess(false), SAVED_NOTICE_MS);
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
        return { ...prev, [key]: current.includes(value) ? current.filter((v) => v !== value) : [...current, value] };
      }
      return { ...prev, [key]: [value] };
    });
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl animate-pulse space-y-4 px-4 py-8 sm:px-6" aria-hidden>
        <div className="h-16 rounded-2xl bg-muted" />
        <div className="h-10 w-2/3 rounded-lg bg-muted" />
        <div className="h-64 rounded-2xl bg-muted" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-6">
        <StatePanel tone="error" title="We could not load settings" message={loadError}>
          <button type="button" onClick={() => { setLoading(true); void loadSettings(); }} className={statePanelActionClass}>
            Try again
          </button>
        </StatePanel>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 pb-28 pt-6 sm:px-6 lg:pt-8">
      <header className="mb-6 flex items-center gap-4">
        <BotAvatar type="pill" state="default" size={48} interactive={false} />
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Settings</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">Decide what the agent works on and how much it does alone.</p>
        </div>
      </header>

      <div role="tablist" aria-label="Settings sections" className="mb-6 flex gap-1 overflow-x-auto border-b border-border">
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={cn(
              '-mb-px shrink-0 border-b-2 px-3 py-2 text-sm font-medium transition-colors',
              tab === id ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="space-y-5">
        {tab === 'workspace' && (
          <>
            <Section title="Business information">
              <div className="space-y-4">
                <div>
                  <label htmlFor="company-name" className="mb-1.5 block text-sm font-medium">
                    Company name
                  </label>
                  <input
                    id="company-name"
                    type="text"
                    value={settings.companyName}
                    onChange={(e) => setSettings({ ...settings, companyName: e.target.value })}
                    className="h-10 w-full rounded-lg border border-border bg-card px-3 text-sm outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
                  />
                </div>
                <div>
                  <span className="mb-1.5 block text-sm font-medium">Industry</span>
                  <OptionGrid
                    options={industryOptions}
                    selected={[settings.industry]}
                    onToggle={(value) => setSettings({ ...settings, industry: value })}
                    columns="sm:grid-cols-3"
                  />
                </div>
              </div>
            </Section>
            <Section title="Monthly marketing budget" hint="The agent will not plan campaigns beyond this.">
              <div className="flex h-11 max-w-xs items-center rounded-lg border border-border bg-card px-3 focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/10">
                <span className="text-sm font-medium text-muted-foreground">INR</span>
                <input
                  type="text"
                  value={settings.budget}
                  onChange={(e) => setSettings({ ...settings, budget: e.target.value })}
                  inputMode="numeric"
                  aria-label="Monthly marketing budget in INR"
                  className="ml-3 min-w-0 flex-1 bg-transparent text-sm font-semibold outline-none"
                />
              </div>
            </Section>
          </>
        )}

        {tab === 'agent' && (
          <>
            <ConsoleCard glow>
              <section className="p-5 sm:p-6">
                <div className="flex items-center gap-3">
                  <BotAvatar type="pill" state="default" size={40} interactive={false} />
                  <div>
                    <h2 className="text-sm font-semibold tracking-tight text-white">Autonomy</h2>
                    <p className="text-xs text-zinc-500">How much the agent does before asking you</p>
                  </div>
                </div>
                <div role="radiogroup" aria-label="Autonomy level" className="mt-5 grid gap-2 sm:grid-cols-3">
                  {involvementOptions.map((option, i) => {
                    const [name, description] = option.split(' — ');
                    const active = settings.involvement.includes(option);
                    return (
                      <button
                        key={option}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        onClick={() => toggleSelection('involvement', option)}
                        className={cn(
                          'rounded-xl border p-4 text-left transition-colors',
                          active ? 'border-indigo-400/60 bg-indigo-400/10' : 'border-white/10 bg-white/[0.03] hover:border-white/20',
                        )}
                      >
                        <span className="flex gap-0.5" aria-hidden>
                          {involvementOptions.map((_, level) => (
                            <span key={level} className={cn('h-1 w-6 rounded-full', level <= i ? 'bg-indigo-400' : 'bg-white/10')} />
                          ))}
                        </span>
                        <span className="mt-3 block text-sm font-semibold text-white">{name}</span>
                        <span className="mt-1 block text-xs leading-relaxed text-zinc-400">{description}</span>
                      </button>
                    );
                  })}
                </div>
              </section>
            </ConsoleCard>
            <Section title="Most important outcome in the next 90 days">
              <OptionGrid options={priorityOptions} selected={settings.priority} onToggle={(value) => toggleSelection('priority', value)} />
            </Section>
            <Section title="How should opportunities be prioritised?">
              <OptionGrid options={audienceOptions} selected={settings.audience} onToggle={(value) => toggleSelection('audience', value)} />
            </Section>
            <Section title="What should the agent look for?">
              <OptionGrid options={engagementOptions} selected={settings.engagement} onToggle={(value) => toggleSelection('engagement', value)} />
            </Section>
            <Section title="Channels it may use">
              <OptionGrid options={channelOptions} selected={settings.channels} onToggle={(value) => toggleSelection('channels', value, true)} />
            </Section>
          </>
        )}

        {tab === 'connections' && (
          <>
            <IntegrationsSection />
            <BillingSection />
          </>
        )}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/90 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <p role="status" className={cn('min-w-0 truncate text-sm', error ? 'text-red-600' : success ? 'text-emerald-600' : 'text-muted-foreground')}>
            {error ?? (success ? 'Saved' : dirty ? 'You have unsaved changes' : 'All changes saved')}
          </p>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !dirty}
            className="inline-flex h-9 shrink-0 items-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {saving ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Save className="size-4" aria-hidden />}
            {saving ? 'Saving' : 'Save changes'}
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

/** Real sends need more than one secret per provider — Twilio is an account SID, an
 * auth token, and a number, not one API key. */
const CREDENTIAL_FIELDS: Record<IntegrationCard['kind'], { key: string; label: string; secret?: boolean }[]> = {
  llm: [{ key: 'apiKey', label: 'OpenRouter API key', secret: true }],
  email: [
    { key: 'apiKey', label: 'Resend API key', secret: true },
    { key: 'fromEmail', label: 'From address (e.g. campaigns@yourbrand.com)' },
  ],
  whatsapp: [
    { key: 'accountSid', label: 'Twilio Account SID' },
    { key: 'authToken', label: 'Twilio Auth Token', secret: true },
    { key: 'whatsappNumber', label: 'WhatsApp-enabled number (e.g. +14155238886)' },
  ],
};

function IntegrationsSection() {
  const [cards, setCards] = useState<IntegrationCard[]>([]);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [draftFields, setDraftFields] = useState<Record<string, Record<string, string>>>({});
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

  function setField(kind: IntegrationCard['kind'], key: string, value: string) {
    setDraftFields((prev) => ({ ...prev, [kind]: { ...prev[kind], [key]: value } }));
  }

  function hasAllFields(kind: IntegrationCard['kind']): boolean {
    const values = draftFields[kind] ?? {};
    return CREDENTIAL_FIELDS[kind].every((f) => (values[f.key] ?? '').trim().length > 0);
  }

  async function save(kind: IntegrationCard['kind'], mode: 'simulator' | 'byok') {
    setBusy(`${kind}:${mode}`);
    setNote(null);
    try {
      const res = await saveIntegration(kind, {
        mode,
        credentials: mode === 'byok' ? draftFields[kind] : undefined,
      });
      setCards((prev) => prev.map((c) => (c.kind === kind ? res.data : c)));
      setNote(mode === 'simulator' ? 'Simulator is on. No tenant key is stored.' : 'Credentials stored encrypted — verify before launching a real campaign.');
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
      setNote(res.data.status === 'ok' ? 'Verified against the real provider.' : 'The provider rejected these credentials.');
    } catch (err) {
      setNote(err instanceof Error ? err.message : 'Verify failed');
    } finally {
      setBusy(null);
    }
  }

  return (
    <Section title="Integrations">
      <p className="mb-4 text-sm text-[var(--muted-foreground)]">
        Simulator is the default and free. Real sends use your own account
        (AES-256-GCM, keys never returned to the browser) — GrowthOS never
        spends its own money sending on your behalf.
      </p>
      {available === false && (
        <p className="mb-4 text-sm text-[var(--muted-foreground)]">
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
              <p className="mt-1 text-xs text-[var(--muted-foreground)]">{copy.hint}</p>
              <p className="mt-3 text-xs font-medium text-[#1A1A1A]">
                Mode: {card.mode} · {card.status}
              </p>
              {card.maskedKey && (
                <p className="mt-1 font-mono text-xs text-[var(--muted-foreground)]">{card.maskedKey}</p>
              )}
              <div className="mt-3 space-y-2">
                {CREDENTIAL_FIELDS[card.kind].map((field) => (
                  <input
                    key={field.key}
                    type={field.secret ? 'password' : 'text'}
                    placeholder={field.label}
                    value={draftFields[card.kind]?.[field.key] ?? ''}
                    onChange={(e) => setField(card.kind, field.key, e.target.value)}
                    className="h-9 w-full rounded-md border border-[#E4E4E7] px-2 text-xs"
                  />
                ))}
              </div>
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
                  disabled={busy !== null || !hasAllFields(card.kind)}
                  onClick={() => save(card.kind, 'byok')}
                  className="rounded-md bg-[#5B4FFF] px-2 py-1 text-xs text-white disabled:opacity-40"
                >
                  Save credentials
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

function BillingSection() {
  const [status, setStatus] = useState<BillingStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    getBillingStatus()
      .then((res) => setStatus(res.data))
      .catch(() => setStatus(null));

    const params = new URLSearchParams(window.location.search);
    if (params.get('billing') === 'success') {
      setNote('Payment received — activation usually lands within a minute. Refresh to see it reflected.');
    } else if (params.get('billing') === 'cancelled') {
      setNote('Checkout cancelled — no changes made.');
    }
  }, []);

  async function upgrade() {
    setBusy(true);
    setNote(null);
    try {
      const { data } = await createBillingCheckout();
      window.location.href = data.url;
    } catch (err) {
      setNote(err instanceof Error ? err.message : 'Could not start checkout');
      setBusy(false);
    }
  }

  return (
    <Section title="Plan">
      <p className="mb-4 text-sm text-[var(--muted-foreground)]">
        Everything is free and unlimited in simulator mode — dashboards, the
        agent, personas, opportunities. Real WhatsApp/Email sends need either
        your own connected key above, or the Pro plan, which sends on
        GrowthOS&apos;s own keys, funded by the subscription.
      </p>
      {note && <p className="mb-4 text-sm text-[#5B4FFF]">{note}</p>}
      <div className="rounded-lg border border-[#E4E4E7] p-4">
        <p className="text-sm font-semibold text-[#1A1A1A]">
          Current plan: {status?.plan === 'pro' ? 'Pro' : 'Free (simulator)'}
        </p>
        {status?.subscriptionStatus && (
          <p className="mt-1 text-xs text-[var(--muted-foreground)]">Subscription: {status.subscriptionStatus}</p>
        )}
        {status && !status.configured && (
          <p className="mt-2 text-xs text-[var(--muted-foreground)]">Billing is not configured on this deployment yet.</p>
        )}
        {status?.plan !== 'pro' && (
          <button
            type="button"
            disabled={busy || !status?.configured}
            onClick={upgrade}
            className="mt-3 rounded-md bg-[#5B4FFF] px-3 py-1.5 text-xs text-white disabled:opacity-40"
          >
            Upgrade to Pro
          </button>
        )}
      </div>
    </Section>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function OptionGrid({
  options,
  selected,
  onToggle,
  columns = 'sm:grid-cols-2',
}: {
  options: string[];
  selected: string[];
  onToggle: (value: string) => void;
  columns?: string;
}) {
  return (
    <div className={cn('grid grid-cols-1 gap-2', columns)}>
      {options.map((option) => {
        const isSelected = selected.includes(option);
        return (
          <button
            key={option}
            type="button"
            aria-pressed={isSelected}
            onClick={() => onToggle(option)}
            className={cn(
              'flex items-center justify-between gap-3 rounded-xl border px-3.5 py-2.5 text-left text-sm font-medium transition-colors',
              isSelected ? 'border-primary/60 bg-accent text-primary' : 'border-border bg-card hover:border-primary/30',
            )}
          >
            {option}
            {isSelected && <Check className="size-4 shrink-0" aria-hidden />}
          </button>
        );
      })}
    </div>
  );
}

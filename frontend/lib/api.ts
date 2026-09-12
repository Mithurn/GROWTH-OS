import { getAuthToken, getUserId } from './supabase/client';
import type {
  AgentGuardrails,
  ApiResponse,
  CampaignWithMetrics,
  GeneratedCampaign,
  Opportunity,
  OpportunityReport,
  PaginatedResponse,
} from './types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'https://xeno-crm-backend-n6d8.onrender.com/api';

// Origin without the /api suffix — for unauthenticated infra routes like /health.
export const BACKEND_ORIGIN = API_BASE_URL.replace(/\/api\/?$/, '');

// ─── In-memory SWR cache ──────────────────────────────────────────────────────
// Module-level singleton — persists across SPA navigation within a session.
// On a cache hit, returns the stale value immediately and refreshes in background.
//
// Entries are namespaced by user id. Without that, signing out and into a second
// account in the same tab serves the previous account's data until the TTL expires,
// because the module singleton outlives the session.
interface CacheEntry { data: unknown; at: number }
const _cache = new Map<string, CacheEntry>();

async function scopedKey(key: string): Promise<string> {
  return `${(await getUserId()) ?? 'anon'}:${key}`;
}

async function swr<T>(key: string, ttlMs: number, fetcher: () => Promise<T>): Promise<T> {
  const k = await scopedKey(key);
  const entry = _cache.get(k);

  if (entry && Date.now() - entry.at < ttlMs) {
    fetcher().then(data => _cache.set(k, { data, at: Date.now() })).catch(() => {});
    return entry.data as T;
  }

  const data = await fetcher();
  _cache.set(k, { data, at: Date.now() });
  return data;
}

/** Drop cached entries whose unscoped key starts with `keyPrefix`, for the current user. */
async function bust(keyPrefix: string) {
  const prefix = await scopedKey(keyPrefix);
  for (const k of _cache.keys()) {
    if (k.startsWith(prefix)) _cache.delete(k);
  }
}

/** Call on sign-out so a subsequent session in the same tab starts clean. */
export function clearApiCache() {
  _cache.clear();
}

function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = 12000): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(id));
}

async function authHeaders(extra: Record<string, string> = {}): Promise<Record<string, string>> {
  const token = await getAuthToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  };
}

async function apiFetch(url: string, options: RequestInit = {}, timeoutMs = 12000): Promise<Response> {
  const headers = await authHeaders((options.headers as Record<string, string>) ?? {});
  return fetchWithTimeout(url, { ...options, headers }, timeoutMs);
}

async function apiJson<T>(
  url: string,
  fallbackError: string,
  options: RequestInit = {},
  timeoutMs = 12000,
): Promise<T> {
  const response = await apiFetch(url, options, timeoutMs);
  if (!response.ok) throw new Error(fallbackError);
  return response.json() as Promise<T>;
}

export async function getCompany() {
  const response = await apiFetch(`${API_BASE_URL}/companies/me`);
  if (!response.ok) throw new Error('Failed to load company');
  return response.json();
}

export async function saveBusinessInfo(companyName: string, industry: string) {
  const response = await apiFetch(`${API_BASE_URL}/onboarding/business`, {
    method: 'POST',
    body: JSON.stringify({ companyName, industry }),
  });

  if (!response.ok) {
    throw new Error('Failed to save business info');
  }

  return response.json();
}

export async function saveOnboardingProfile(profile: Record<string, unknown>) {
  const response = await apiFetch(`${API_BASE_URL}/onboarding/profile`, {
    method: 'POST',
    body: JSON.stringify({ profile }),
  });

  if (!response.ok) {
    throw new Error('Failed to save onboarding profile');
  }

  return response.json();
}

export async function startOnboardingConversation() {
  const response = await apiFetch(`${API_BASE_URL}/onboarding/conversation/start`, {
    method: 'POST',
    body: JSON.stringify({}),
  });

  if (!response.ok) {
    throw new Error('Failed to start conversation');
  }

  return response.json();
}

export async function sendConversationMessage(conversationId: string, message: string) {
  const response = await apiFetch(`${API_BASE_URL}/onboarding/conversation/${conversationId}/message`, {
    method: 'POST',
    body: JSON.stringify({ message }),
  });

  if (!response.ok) {
    throw new Error('Failed to send message');
  }

  return response.json();
}

export async function uploadCustomerCSV(file: File) {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`${API_BASE_URL}/upload/customers`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    throw new Error('Failed to upload customer CSV');
  }

  return response.json();
}

export async function uploadOrderCSV(file: File) {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`${API_BASE_URL}/upload/orders`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    throw new Error('Failed to upload order CSV');
  }

  return response.json();
}

export async function startIngestion(customerFile: File, orderFile: File) {
  const formData = new FormData();
  formData.append('customers', customerFile);
  formData.append('orders', orderFile);

  const token = await getAuthToken();
  const response = await fetchWithTimeout(`${API_BASE_URL}/process-ingestion`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  }, 30000);

  if (!response.ok) {
    throw new Error('Failed to start ingestion');
  }

  return response.json();
}

/**
 * Seed the caller's own company with the demo dataset bundled in the backend repo.
 * Returns an ingestion session id that polls through `getIngestionStatus` exactly like
 * a real CSV upload.
 */
export async function seedDemoData(): Promise<{ sessionId: string }> {
  const response = await apiFetch(`${API_BASE_URL}/onboarding/demo-seed`, {
    method: 'POST',
  }, 60_000);
  if (!response.ok) throw new Error('Failed to load demo data');
  const json = await response.json();
  return { sessionId: json.sessionId };
}

export async function getIngestionStatus(sessionId: string) {
  const response = await apiFetch(`${API_BASE_URL}/ingestion-status/${sessionId}`);

  if (!response.ok) {
    throw new Error('Failed to get ingestion status');
  }

  return response.json();
}

export function getIntelligencePreview() {
  return swr('intel-preview', 300_000, async () => {
    const response = await apiFetch(`${API_BASE_URL}/intelligence-preview`);
    if (!response.ok) throw new Error('Failed to get intelligence preview');
    return response.json();
  });
}

export async function getIntelligenceBrief() {
  const response = await apiFetch(`${API_BASE_URL}/analytics/intelligence-brief`);

  if (!response.ok) {
    return null;
  }

  return response.json();
}

export async function generatePersonas(model?: string) {
  const response = await apiFetch(`${API_BASE_URL}/personas/generate`, {
    method: 'POST',
    body: JSON.stringify({ model }),
  });

  if (!response.ok) {
    throw new Error('Failed to generate personas');
  }

  await bust('personas');
  return response.json();
}

export async function generateOpportunities(model?: string) {
  const response = await apiFetch(`${API_BASE_URL}/opportunities/generate`, {
    method: 'POST',
    body: JSON.stringify({ model }),
  });

  if (!response.ok) {
    throw new Error('Failed to generate opportunities');
  }

  return response.json();
}

export function getOpportunityDashboard() {
  return swr('opp-dashboard', 90_000, async () => {
    const response = await apiFetch(`${API_BASE_URL}/opportunities`, {}, 12000);
    if (!response.ok) throw new Error('Failed to fetch opportunities');
    return response.json();
  });
}

export async function getOpportunityCustomers(opportunityId: string) {
  const response = await apiFetch(`${API_BASE_URL}/opportunities/${encodeURIComponent(opportunityId)}`);
  if (!response.ok) throw new Error('Failed to fetch opportunity details');
  return response.json();
}

export async function createOpportunityFromGoal(goal: string, model?: string) {
  const response = await apiFetch(`${API_BASE_URL}/opportunities/create-from-goal`, {
    method: 'POST',
    body: JSON.stringify({ goal, model }),
  }, 60000);
  if (!response.ok) throw new Error('Failed to create opportunity from goal');
  await bust('opp-dashboard');
  return response.json();
}

export function getPersonaDistribution() {
  return swr('personas', 300_000, async () => {
    const response = await apiFetch(`${API_BASE_URL}/personas`);
    if (!response.ok) throw new Error('Failed to fetch personas');
    return response.json();
  });
}

export async function getPersonaCustomers(personaName: string) {
  const response = await apiFetch(`${API_BASE_URL}/personas/${encodeURIComponent(personaName)}`);
  if (!response.ok) throw new Error('Failed to fetch persona customers');
  return response.json();
}

// ============================================
// CAMPAIGNS
// ============================================

export async function generateCampaign(opportunityId: string, model?: string) {
  const response = await apiFetch(`${API_BASE_URL}/campaigns/generate`, {
    method: 'POST',
    body: JSON.stringify({ opportunityId, model }),
  }, 90000);
  if (!response.ok) throw new Error('Failed to generate campaign');
  return response.json();
}

export async function saveCampaign(opportunityId: string, campaign: GeneratedCampaign) {
  const response = await apiFetch(`${API_BASE_URL}/campaigns`, {
    method: 'POST',
    body: JSON.stringify({ opportunityId, campaign }),
  });
  if (!response.ok) throw new Error('Failed to save campaign');
  await bust('campaigns-');
  return response.json();
}

export function getCampaigns(opts?: { page?: number; limit?: number }) {
  const params = new URLSearchParams();
  if (opts?.page) params.set('page', String(opts.page));
  if (opts?.limit) params.set('limit', String(opts.limit));
  const qs = params.toString();
  const key = `campaigns-${qs}`;
  return swr(key, 90_000, async () => {
    const response = await apiFetch(`${API_BASE_URL}/campaigns${qs ? `?${qs}` : ''}`);
    if (!response.ok) throw new Error('Failed to fetch campaigns');
    return response.json();
  });
}

export async function getCampaignById(campaignId: string) {
  const response = await apiFetch(`${API_BASE_URL}/campaigns/${encodeURIComponent(campaignId)}`);
  if (!response.ok) throw new Error('Failed to fetch campaign');
  return response.json();
}

export async function approveCampaign(campaignId: string) {
  const response = await apiFetch(`${API_BASE_URL}/campaigns/${encodeURIComponent(campaignId)}/approve`, {
    method: 'POST',
  });
  if (!response.ok) throw new Error('Failed to approve campaign');
  await bust('campaigns-');
  return response.json();
}

export async function launchCampaign(campaignId: string) {
  const response = await apiFetch(`${API_BASE_URL}/campaigns/${encodeURIComponent(campaignId)}/launch`, {
    method: 'POST',
    // Launch fans out sends and first wakes the spun-down channel service.
  }, 120_000);
  if (!response.ok) throw new Error('Failed to launch campaign');
  await bust('campaigns-');
  return response.json();
}

export async function getCampaignAnalytics(campaignId: string) {
  const response = await apiFetch(
    `${API_BASE_URL}/campaigns/${encodeURIComponent(campaignId)}/analytics`,
  );
  if (!response.ok) throw new Error('Failed to fetch campaign analytics');
  return response.json();
}

// ============================================
// AI AGENTS
// ============================================

export async function createAgent(goal: string, guardrails?: AgentGuardrails) {
  const response = await apiFetch(`${API_BASE_URL}/agents`, {
    method: 'POST',
    body: JSON.stringify({ goal, guardrails }),
  });
  if (!response.ok) throw new Error('Failed to create agent');
  return response.json();
}

export function getAgents(opts?: { page?: number; limit?: number }) {
  const params = new URLSearchParams();
  if (opts?.page) params.set('page', String(opts.page));
  if (opts?.limit) params.set('limit', String(opts.limit));
  const qs = params.toString();
  const key = `agents-${qs}`;
  return swr(key, 120_000, async () => {
    const response = await apiFetch(`${API_BASE_URL}/agents${qs ? `?${qs}` : ''}`);
    if (!response.ok) throw new Error('Failed to fetch agents');
    return response.json();
  });
}

export async function getAgent(agentId: string) {
  const response = await apiFetch(`${API_BASE_URL}/agents/${encodeURIComponent(agentId)}`);
  if (!response.ok) throw new Error('Failed to fetch agent');
  return response.json();
}

export async function runAgent(agentId: string) {
  const response = await apiFetch(`${API_BASE_URL}/agents/${encodeURIComponent(agentId)}/run`, {
    method: 'POST',
  });
  if (!response.ok) throw new Error('Failed to run agent');
  return response.json();
}

export async function updateAgent(agentId: string, updates: { status?: string; guardrails?: AgentGuardrails }) {
  const response = await apiFetch(`${API_BASE_URL}/agents/${encodeURIComponent(agentId)}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
  if (!response.ok) throw new Error('Failed to update agent');
  return response.json();
}

export function getActivityStream(limit?: number) {
  const key = `activity-${limit ?? ''}`;
  return swr(key, 15_000, async () => {
    const url = new URL(`${API_BASE_URL}/activity-stream`);
    if (limit) url.searchParams.set('limit', limit.toString());
    const response = await apiFetch(url.toString(), {}, 8000);
    if (!response.ok) throw new Error('Failed to fetch activity stream');
    return response.json();
  });
}

export async function refineOpportunity(opportunityId: string, modifier: string) {
  const response = await apiFetch(`${API_BASE_URL}/opportunities/${encodeURIComponent(opportunityId)}/refine`, {
    method: 'POST',
    body: JSON.stringify({ modifier }),
  });

  if (!response.ok) {
    throw new Error('Failed to refine opportunity');
  }

  return response.json();
}

export async function refineCampaign(campaignId: string, modifier: string, channel?: string) {
  const response = await apiFetch(`${API_BASE_URL}/campaigns/${encodeURIComponent(campaignId)}/refine`, {
    method: 'POST',
    body: JSON.stringify({ modifier, channel }),
  });

  if (!response.ok) {
    throw new Error('Failed to refine campaign message');
  }

  return response.json();
}

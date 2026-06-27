import OpenAI from 'openai';
import type { SupabaseClient } from '@supabase/supabase-js';
import { openRouterConfig } from '../config/openrouter';
import { logger as rootLogger } from '../lib/logger';

export interface PersonaLogger {
  info: (message: string, ...args: unknown[]) => void;
  warn: (message: string, ...args: unknown[]) => void;
  error: (message: string, ...args: unknown[]) => void;
}

export interface PersonaRecord {
  id?: string;
  company_id: string;
  customer_id: string;
  persona_name: string;
  persona_description: string;
  confidence_score: number;
  updated_at?: string;
}

export interface PersonaDistributionRow {
  persona_name: string;
  persona_description: string;
  customer_count: number;
  total_spent: number;
  average_spend: number;
  revenue_share: number;
  average_orders: number;
  average_days_since_last_order: number | null;
}

export interface PersonaCustomerRow {
  customer_id: string;
  customer_name: string;
  total_spent: number;
  total_orders: number;
  avg_order_value: number;
  days_since_last_order: number | null;
  favorite_category: string | null;
  second_favorite_category: string | null;
  preferred_channel: string | null;
  discount_affinity: string | null;
  dominant_price_band: string | null;
  category_diversity_score: number | null;
  persona_name: string;
  persona_description: string;
  confidence_score: number;
}

export interface PersonaGenerationReport {
  generatedAt: string;
  companyId: string;
  totalCustomers: number;
  totalPersonas: number;
  personasAssigned: number;
  personaDistribution: PersonaDistributionRow[];
  sampleCustomers: PersonaCustomerRow[];
  validation: PersonaValidationSummary;
}

export interface PersonaValidationSummary {
  everyCustomerHasPersona: boolean;
  personaCountReasonable: boolean;
  descriptionsPopulated: boolean;
  confidenceScoresPopulated: boolean;
}

export interface PersonaGroupProfile {
  personaKey: string;
  suggestedPersonaName: string;
  summary: string;
  customerCount: number;
  averageSpend: number;
  averageOrders: number;
  averageDaysSinceLastOrder: number | null;
  averageCategoryDiversity: number;
  topCategories: string[];
  topChannels: string[];
  topDiscountAffinity: string;
  sampleCustomers: PersonaCustomerRow[];
}

interface CustomerRow {
  id: string;
  first_name: string;
  last_name: string | null;
}

interface MetricRow {
  customer_id: string;
  total_orders: number | string;
  total_spent: number | string;
  avg_order_value: number | string;
  last_order_date: string | null;
  days_since_last_order: number | string | null;
  purchase_frequency: string | null;
  engagement_score: number | string | null;
}

interface AttributeRow {
  customer_id: string;
  favorite_category: string | null;
  second_favorite_category: string | null;
  preferred_channel: string | null;
  discount_affinity: string | null;
  avg_days_between_orders: number | string | null;
  dominant_price_band: string | null;
  category_diversity_score: number | string;
}

interface CompanyRow {
  id: string;
  company_name: string;
  industry: string | null;
}

interface PersonaGenerationOptions {
  companyId?: string;
  model?: string;
  logger?: PersonaLogger;
}

interface RawPersonaResponse {
  persona_name: string;
  persona_description: string;
  confidence_score: number;
}

const defaultLogger: PersonaLogger = {
  info:  (msg, ...args) => rootLogger.info(args[0] ?? {}, msg),
  warn:  (msg, ...args) => rootLogger.warn(args[0] ?? {}, msg),
  error: (msg, ...args) => rootLogger.error(args[0] ?? {}, msg),
};

const ETHNIC_CATEGORIES = new Set([
  "Women's Kurtas",
  "Men's Kurtas",
  'Sarees',
  'Dupattas',
  'Scarves',
]);

function toNumber(value: number | string | null | undefined): number {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

function roundToTwo(value: number): number {
  return Math.round(value * 100) / 100;
}

function toDateKey(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length >= 10 ? trimmed.slice(0, 10) : null;
}

function normalizeConfidence(value: number | string | null | undefined): number {
  const parsed = typeof value === 'string' ? Number.parseFloat(value) : (value ?? 0);
  if (!Number.isFinite(parsed)) return 0.5;
  if (parsed > 1) return roundToTwo(Math.max(0, Math.min(1, parsed / 100)));
  return roundToTwo(Math.max(0, Math.min(1, parsed)));
}

function summarizeText(value: string, maxLength = 220): string {
  const trimmed = value.trim().replace(/\s+/g, ' ');
  if (trimmed.length <= maxLength) return trimmed;
  return `${trimmed.slice(0, maxLength - 1).trim()}…`;
}

function buildCustomerName(customer: CustomerRow): string {
  const lastName = customer.last_name?.trim();
  return lastName ? `${customer.first_name} ${lastName}` : customer.first_name;
}

function determinePersonaKey(profile: CustomerProfile): { key: string; label: string; rationale: string } {
  const hasNoOrders = profile.totalOrders <= 0;
  const isDormant = profile.daysSinceLastOrder !== null && profile.daysSinceLastOrder >= 120;
  const isVeryRecent = profile.daysSinceLastOrder !== null && profile.daysSinceLastOrder <= 30;
  const isHighValue = profile.totalSpent >= 20000 || profile.totalOrders >= 8;
  const isPremium = profile.totalSpent >= 25000 && profile.totalOrders >= 6;
  const isDiscountHeavy = profile.discountAffinity === 'High';
  const isLowDiversity = profile.categoryDiversityScore !== null && profile.categoryDiversityScore <= 45;
  const isHighDiversity = profile.categoryDiversityScore !== null && profile.categoryDiversityScore >= 70;
  const isEthnicFocused = profile.favoriteCategory ? ETHNIC_CATEGORIES.has(profile.favoriteCategory) : false;
  const hasLongGaps = profile.avgDaysBetweenOrders !== null && profile.avgDaysBetweenOrders >= 45;

  if (hasNoOrders) {
    return {
      key: 'no_purchase',
      label: 'Unconverted Prospect',
      rationale: 'No purchases yet, but customer record exists in the CRM.',
    };
  }

  if (isDormant && isHighValue) {
    return {
      key: 'dormant_vip',
      label: 'Dormant VIP',
      rationale: 'High value customer with recent inactivity.',
    };
  }

  if (isPremium && isVeryRecent) {
    return {
      key: 'premium_loyalist',
      label: 'Premium Loyalist',
      rationale: 'High spending and frequent recent purchases.',
    };
  }

  if (isDiscountHeavy && profile.totalSpent < 20000) {
    return {
      key: 'discount_hunter',
      label: 'Discount Hunter',
      rationale: 'Frequently buys lower-ticket items and appears promotion-sensitive.',
    };
  }

  if (isEthnicFocused && isLowDiversity) {
    return {
      key: 'ethnic_wear_loyalist',
      label: 'Ethnic Wear Loyalist',
      rationale: 'Strong preference for ethnic wear categories.',
    };
  }

  if (isHighDiversity && profile.totalOrders >= 3) {
    return {
      key: 'cross_sell_candidate',
      label: 'Cross-Sell Candidate',
      rationale: 'Buys across multiple categories, making adjacent recommendations viable.',
    };
  }

  if (hasLongGaps || (profile.averageOrdersPerGap >= 1 && profile.totalOrders >= 2)) {
    return {
      key: 'seasonal_buyer',
      label: 'Seasonal Buyer',
      rationale: 'Purchases happen in spaced bursts rather than steadily.',
    };
  }

  if (isHighValue) {
    return {
      key: 'high_potential_customer',
      label: 'High Potential Customer',
      rationale: 'Shows solid monetization potential with room to grow.',
    };
  }

  return {
    key: 'regular_buyer',
    label: 'Regular Buyer',
    rationale: 'Consistent but not yet strongly differentiated purchasing behavior.',
  };
}

interface CustomerProfile {
  customerId: string;
  customerName: string;
  totalOrders: number;
  totalSpent: number;
  avgOrderValue: number;
  daysSinceLastOrder: number | null;
  purchaseFrequency: string | null;
  engagementScore: number;
  favoriteCategory: string | null;
  secondFavoriteCategory: string | null;
  preferredChannel: string | null;
  discountAffinity: string | null;
  avgDaysBetweenOrders: number | null;
  dominantPriceBand: string | null;
  categoryDiversityScore: number | null;
  averageOrdersPerGap: number;
}

interface PersonaCluster {
  personaKey: string;
  label: string;
  rationale: string;
  customers: CustomerProfile[];
}

function buildClusterSummary(cluster: PersonaCluster): PersonaGroupProfile {
  const totalSpent = cluster.customers.reduce((sum, customer) => sum + customer.totalSpent, 0);
  const totalOrders = cluster.customers.reduce((sum, customer) => sum + customer.totalOrders, 0);
  const avgDays = cluster.customers.filter((customer) => customer.daysSinceLastOrder !== null).reduce((sum, customer) => sum + (customer.daysSinceLastOrder ?? 0), 0);
  const avgDiversity = cluster.customers.filter((customer) => customer.categoryDiversityScore !== null).reduce((sum, customer) => sum + (customer.categoryDiversityScore ?? 0), 0);

  const categoryCounts = new Map<string, number>();
  const channelCounts = new Map<string, number>();
  const discountCounts = new Map<string, number>();

  for (const customer of cluster.customers) {
    if (customer.favoriteCategory) {
      categoryCounts.set(customer.favoriteCategory, (categoryCounts.get(customer.favoriteCategory) ?? 0) + 1);
    }
    if (customer.preferredChannel) {
      channelCounts.set(customer.preferredChannel, (channelCounts.get(customer.preferredChannel) ?? 0) + 1);
    }
    if (customer.discountAffinity) {
      discountCounts.set(customer.discountAffinity, (discountCounts.get(customer.discountAffinity) ?? 0) + 1);
    }
  }

  const topCategories = [...categoryCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([category]) => category);
  const topChannels = [...channelCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([channel]) => channel);
  const topDiscountAffinity = [...discountCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'Low';

  const sampleCustomers = cluster.customers.slice(0, 3).map((customer) => ({
    customer_id: customer.customerId,
    customer_name: customer.customerName,
    total_spent: customer.totalSpent,
    total_orders: customer.totalOrders,
    avg_order_value: customer.avgOrderValue,
    days_since_last_order: customer.daysSinceLastOrder,
    favorite_category: customer.favoriteCategory,
    second_favorite_category: customer.secondFavoriteCategory,
    preferred_channel: customer.preferredChannel,
    discount_affinity: customer.discountAffinity,
    dominant_price_band: customer.dominantPriceBand,
    category_diversity_score: customer.categoryDiversityScore,
    persona_name: cluster.label,
    persona_description: cluster.rationale,
    confidence_score: 0,
  }));

  return {
    personaKey: cluster.personaKey,
    suggestedPersonaName: cluster.label,
    summary: cluster.rationale,
    customerCount: cluster.customers.length,
    averageSpend: roundToTwo(totalSpent / Math.max(1, cluster.customers.length)),
    averageOrders: roundToTwo(totalOrders / Math.max(1, cluster.customers.length)),
    averageDaysSinceLastOrder: cluster.customers.some((customer) => customer.daysSinceLastOrder !== null)
      ? roundToTwo(avgDays / cluster.customers.filter((customer) => customer.daysSinceLastOrder !== null).length)
      : null,
    averageCategoryDiversity: roundToTwo(avgDiversity / Math.max(1, cluster.customers.filter((customer) => customer.categoryDiversityScore !== null).length)),
    topCategories,
    topChannels,
    topDiscountAffinity,
    sampleCustomers,
  };
}

function parsePersonaResponse(raw: string): RawPersonaResponse | null {
  const trimmed = raw.trim();
  const candidate = trimmed.startsWith('```') ? trimmed.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim() : trimmed;

  try {
    const parsed = JSON.parse(candidate) as RawPersonaResponse;
    if (!parsed?.persona_name || !parsed?.persona_description) {
      return null;
    }

    return {
      persona_name: String(parsed.persona_name).trim(),
      persona_description: String(parsed.persona_description).trim(),
      confidence_score: normalizeConfidence(parsed.confidence_score),
    };
  } catch {
    return null;
  }
}

function buildPersonaPrompt(cluster: PersonaCluster, profile: PersonaGroupProfile): string {
  return [
    'You are a retail CRM strategist.',
    'Generate a business-friendly customer persona from the provided grouped customer data.',
    'Return JSON only with exactly these keys: persona_name, persona_description, confidence_score.',
    'persona_name should be 2-4 words, easy for marketers to understand.',
    'persona_description should be concise, one sentence max, and explain the behavior.',
    'confidence_score must be between 0 and 1.',
    '',
    `Suggested persona: ${cluster.label}`,
    `Reason: ${cluster.rationale}`,
    `Cluster size: ${profile.customerCount}`,
    `Average spend: ${profile.averageSpend}`,
    `Average orders: ${profile.averageOrders}`,
    `Average days since last order: ${profile.averageDaysSinceLastOrder ?? 'n/a'}`,
    `Average category diversity score: ${profile.averageCategoryDiversity}`,
    `Top categories: ${profile.topCategories.join(', ') || 'n/a'}`,
    `Top channels: ${profile.topChannels.join(', ') || 'n/a'}`,
    `Dominant discount affinity: ${profile.topDiscountAffinity}`,
    'Sample customers:',
    JSON.stringify(profile.sampleCustomers, null, 2),
  ].join('\n');
}

async function generatePersonaNarrative(
  client: OpenAI,
  model: string,
  cluster: PersonaCluster,
  profile: PersonaGroupProfile,
): Promise<RawPersonaResponse> {
  const response = await client.chat.completions.create({
    model,
    temperature: 0.2,
    max_tokens: 256,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: 'You output only valid JSON and never include markdown.',
      },
      {
        role: 'user',
        content: buildPersonaPrompt(cluster, profile),
      },
    ],
  });

  const content = response.choices[0]?.message?.content ?? '';
  const parsed = parsePersonaResponse(content);
  if (!parsed) {
    throw new Error('Persona model returned invalid JSON');
  }

  return parsed;
}

function fallbackPersonaNarrative(cluster: PersonaCluster): RawPersonaResponse {
  return {
    persona_name: cluster.label,
    persona_description: summarizeText(cluster.rationale, 120),
    confidence_score: 0.72,
  };
}

function clusterProfiles(customers: CustomerProfile[]): PersonaCluster[] {
  const clusters = new Map<string, PersonaCluster>();

  for (const customer of customers) {
    const { key, label, rationale } = determinePersonaKey(customer);
    const cluster = clusters.get(key) ?? {
      personaKey: key,
      label,
      rationale,
      customers: [],
    };

    cluster.customers.push(customer);
    clusters.set(key, cluster);
  }

  return [...clusters.values()].sort((a, b) => b.customers.length - a.customers.length || a.label.localeCompare(b.label));
}

async function ensureCompanyRow(
  supabase: SupabaseClient,
  companyId?: string,
): Promise<CompanyRow> {
  if (companyId) {
    const { data, error } = await supabase
      .from('companies')
      .select('id, company_name, industry')
      .eq('id', companyId)
      .maybeSingle();

    if (error) throw error;
    if (data) return data as CompanyRow;
  }

  const { data: existing, error: existingError } = await supabase
    .from('companies')
    .select('id, company_name, industry')
    .order('created_at', { ascending: true })
    .limit(1);

  if (existingError) {
    throw new Error(`Failed to inspect companies table: ${existingError.message}`);
  }

  if (existing && existing.length > 0) {
    return existing[0] as CompanyRow;
  }

  const { data: inserted, error: insertError } = await supabase
    .from('companies')
    .upsert({
      company_name: 'GrowthOS Demo Fashion',
      industry: 'Fashion',
    }, { onConflict: 'company_name' })
    .select('id, company_name, industry')
    .single();

  if (insertError) {
    throw new Error(`Failed to create default company row: ${insertError.message}`);
  }

  return inserted as CompanyRow;
}

async function upsertPersonaRows(
  supabase: SupabaseClient,
  records: PersonaRecord[],
): Promise<void> {
  const { error } = await supabase
    .from('personas')
    .upsert(records, { onConflict: 'customer_id' });

  if (error) {
    throw new Error(`Failed to upsert personas: ${error.message}`);
  }
}

async function fetchPersonaRows(
  supabase: SupabaseClient,
  companyId: string,
): Promise<Array<PersonaRecord & { customers?: CustomerRow | CustomerRow[] | null }>> {
  const { data, error } = await supabase
    .from('personas')
    .select('id, company_id, customer_id, persona_name, persona_description, confidence_score, customers(id, first_name, last_name)')
    .eq('company_id', companyId)
    .order('persona_name', { ascending: true });

  if (error) {
    throw new Error(`Failed to load personas: ${error.message}`);
  }

  return (data ?? []) as unknown as Array<PersonaRecord & { customers?: CustomerRow | CustomerRow[] | null }>;
}

async function fetchMetricsByCustomer(supabase: SupabaseClient): Promise<Map<string, MetricRow>> {
  const { data, error } = await supabase
    .from('customer_metrics')
    .select('customer_id, total_orders, total_spent, avg_order_value, last_order_date, days_since_last_order, purchase_frequency, engagement_score');

  if (error) {
    throw new Error(`Failed to load customer metrics: ${error.message}`);
  }

  return new Map((data ?? []).map((row) => [row.customer_id, row as MetricRow]));
}

async function fetchAttributesByCustomer(supabase: SupabaseClient): Promise<Map<string, AttributeRow>> {
  const { data, error } = await supabase
    .from('customer_attributes')
    .select('customer_id, favorite_category, second_favorite_category, preferred_channel, discount_affinity, avg_days_between_orders, dominant_price_band, category_diversity_score');

  if (error) {
    throw new Error(`Failed to load customer attributes: ${error.message}`);
  }

  return new Map((data ?? []).map((row) => [row.customer_id, row as AttributeRow]));
}

async function fetchCustomers(supabase: SupabaseClient): Promise<CustomerRow[]> {
  const { data, error } = await supabase
    .from('customers')
    .select('id, first_name, last_name')
    .order('created_at', { ascending: true });

  if (error) {
    throw new Error(`Failed to load customers: ${error.message}`);
  }

  return (data ?? []) as CustomerRow[];
}

function buildProfiles(
  customers: CustomerRow[],
  metricsByCustomer: Map<string, MetricRow>,
  attributesByCustomer: Map<string, AttributeRow>,
): CustomerProfile[] {
  return customers.map((customer) => {
    const metrics = metricsByCustomer.get(customer.id);
    const attributes = attributesByCustomer.get(customer.id);
    const totalOrders = toNumber(metrics?.total_orders);
    const totalSpent = roundToTwo(toNumber(metrics?.total_spent));
    const avgOrderValue = roundToTwo(toNumber(metrics?.avg_order_value));
    const daysSinceLastOrder = metrics?.days_since_last_order === null || metrics?.days_since_last_order === undefined
      ? null
      : Math.max(0, Math.trunc(toNumber(metrics.days_since_last_order)));
    const averageOrdersPerGap = attributes?.avg_days_between_orders ? 1 / Math.max(1, toNumber(attributes.avg_days_between_orders)) : 0;

    return {
      customerId: customer.id,
      customerName: buildCustomerName(customer),
      totalOrders,
      totalSpent,
      avgOrderValue,
      daysSinceLastOrder,
      purchaseFrequency: metrics?.purchase_frequency ?? null,
      engagementScore: roundToTwo(toNumber(metrics?.engagement_score)),
      favoriteCategory: attributes?.favorite_category ?? null,
      secondFavoriteCategory: attributes?.second_favorite_category ?? null,
      preferredChannel: attributes?.preferred_channel ?? null,
      discountAffinity: attributes?.discount_affinity ?? null,
      avgDaysBetweenOrders: attributes?.avg_days_between_orders === null || attributes?.avg_days_between_orders === undefined
        ? null
        : roundToTwo(toNumber(attributes.avg_days_between_orders)),
      dominantPriceBand: attributes?.dominant_price_band ?? null,
      categoryDiversityScore: attributes?.category_diversity_score === null || attributes?.category_diversity_score === undefined
        ? null
        : roundToTwo(toNumber(attributes.category_diversity_score)),
      averageOrdersPerGap,
    };
  });
}

function buildDistribution(records: PersonaRecord[], profiles: CustomerProfile[]): PersonaDistributionRow[] {
  const profileByCustomer = new Map(profiles.map((profile) => [profile.customerId, profile]));
  const grouped = new Map<string, Array<PersonaRecord & { profile?: CustomerProfile }>>();

  for (const record of records) {
    const bucket = grouped.get(record.persona_name) ?? [];
    bucket.push({ ...record, profile: profileByCustomer.get(record.customer_id) });
    grouped.set(record.persona_name, bucket);
  }

  const totalRevenue = profiles.reduce((sum, profile) => sum + profile.totalSpent, 0);

  return [...grouped.entries()]
    .map(([personaName, rows]) => {
      const totalSpent = rows.reduce((sum, row) => sum + (row.profile?.totalSpent ?? 0), 0);
      const totalOrders = rows.reduce((sum, row) => sum + (row.profile?.totalOrders ?? 0), 0);
      const days = rows
        .map((row) => row.profile?.daysSinceLastOrder)
        .filter((value): value is number => value !== null && value !== undefined);
      const personaDescription = rows[0]?.persona_description ?? '';

      return {
        persona_name: personaName,
        persona_description: personaDescription,
        customer_count: rows.length,
        total_spent: roundToTwo(totalSpent),
        average_spend: roundToTwo(totalSpent / Math.max(1, rows.length)),
        revenue_share: roundToTwo((totalSpent / Math.max(1, totalRevenue)) * 100),
        average_orders: roundToTwo(totalOrders / Math.max(1, rows.length)),
        average_days_since_last_order: days.length > 0 ? roundToTwo(days.reduce((sum, value) => sum + value, 0) / days.length) : null,
      };
    })
    .sort((a, b) => b.customer_count - a.customer_count || b.total_spent - a.total_spent);
}

export async function generatePersonas(
  supabase: SupabaseClient,
  options: PersonaGenerationOptions = {},
): Promise<PersonaGenerationReport> {
  const logger = options.logger ?? defaultLogger;
  const company = await ensureCompanyRow(supabase, options.companyId);
  const model = options.model ?? openRouterConfig.defaultModel;
  const client = new OpenAI({
    apiKey: openRouterConfig.apiKey,
    baseURL: openRouterConfig.baseUrl,
    defaultHeaders: {
      'HTTP-Referer': openRouterConfig.httpReferer,
      'X-Title': openRouterConfig.appName,
    },
  });

  logger.info(`[personas] Starting persona generation for company=${company.company_name} (${company.id})`);

  const customers = await fetchCustomers(supabase);
  const metricsByCustomer = await fetchMetricsByCustomer(supabase);
  const attributesByCustomer = await fetchAttributesByCustomer(supabase);
  const profiles = buildProfiles(customers, metricsByCustomer, attributesByCustomer);
  const clusters = clusterProfiles(profiles);

  const personaRecords: PersonaRecord[] = [];
  const sampleCustomers: PersonaCustomerRow[] = [];

  for (const cluster of clusters) {
    const profileSummary = buildClusterSummary(cluster);
    let aiPersona: RawPersonaResponse;

    try {
      aiPersona = await generatePersonaNarrative(client, model, cluster, profileSummary);
    } catch (error) {
      logger.warn(
        `[personas] Falling back to deterministic persona for ${cluster.label} (${cluster.personaKey})`,
        error,
      );
      aiPersona = fallbackPersonaNarrative(cluster);
    }

    const personaName = summarizeText(aiPersona.persona_name || cluster.label, 48);
    const personaDescription = summarizeText(aiPersona.persona_description || cluster.rationale, 180);
    const confidence = normalizeConfidence(aiPersona.confidence_score);

    for (const customer of cluster.customers) {
      personaRecords.push({
        company_id: company.id,
        customer_id: customer.customerId,
        persona_name: personaName,
        persona_description: personaDescription,
        confidence_score: confidence,
        updated_at: new Date().toISOString(),
      });

      sampleCustomers.push({
        customer_id: customer.customerId,
        customer_name: customer.customerName,
        total_spent: customer.totalSpent,
        total_orders: customer.totalOrders,
        avg_order_value: customer.avgOrderValue,
        days_since_last_order: customer.daysSinceLastOrder,
        favorite_category: customer.favoriteCategory,
        second_favorite_category: customer.secondFavoriteCategory,
        preferred_channel: customer.preferredChannel,
        discount_affinity: customer.discountAffinity,
        dominant_price_band: customer.dominantPriceBand,
        category_diversity_score: customer.categoryDiversityScore,
        persona_name: personaName,
        persona_description: personaDescription,
        confidence_score: confidence,
      });
    }

    logger.info(
      `[personas] Cluster ${cluster.personaKey} -> ${personaName} (${cluster.customers.length} customers, confidence=${confidence})`,
    );
  }

  if (personaRecords.length === 0) {
    throw new Error('No personas could be generated from the available customer data');
  }

  await upsertPersonaRows(supabase, personaRecords);

  const persistedRows = await fetchPersonaRows(supabase, company.id);
  const distribution = buildDistribution(persistedRows, profiles);
  const totalPersonas = distribution.length;
  const everyCustomerHasPersona = persistedRows.length === customers.length;
  const personaCountReasonable = totalPersonas >= 3 && totalPersonas <= 12;
  const descriptionsPopulated = persistedRows.every((row) => Boolean(row.persona_description?.trim()));
  const confidenceScoresPopulated = persistedRows.every((row) => typeof row.confidence_score === 'number' || row.confidence_score !== null);

  logger.info(
    `[personas] Generation complete. customers=${customers.length}, personas=${persistedRows.length}, groups=${totalPersonas}`,
  );
  logger.info('[personas] Persona distribution:', distribution);

  return {
    generatedAt: new Date().toISOString(),
    companyId: company.id,
    totalCustomers: customers.length,
    totalPersonas,
    personasAssigned: persistedRows.length,
    personaDistribution: distribution,
    sampleCustomers: sampleCustomers.slice(0, 15),
    validation: {
      everyCustomerHasPersona,
      personaCountReasonable,
      descriptionsPopulated,
      confidenceScoresPopulated,
    },
  };
}

export async function getPersonaDistribution(
  supabase: SupabaseClient,
  companyId?: string,
): Promise<{ companyId: string; personaDistribution: PersonaDistributionRow[]; totalCustomers: number; totalPersonas: number; totalRevenue: number; }> {
  const company = await ensureCompanyRow(supabase, companyId);
  const customers = await fetchCustomers(supabase);
  const metricsByCustomer = await fetchMetricsByCustomer(supabase);
  const persistedRows = await fetchPersonaRows(supabase, company.id);
  const profiles = buildProfiles(customers, metricsByCustomer, await fetchAttributesByCustomer(supabase));
  const distribution = buildDistribution(persistedRows, profiles);
  const totalRevenue = profiles.reduce((sum, profile) => sum + profile.totalSpent, 0);

  return {
    companyId: company.id,
    personaDistribution: distribution,
    totalCustomers: customers.length,
    totalPersonas: distribution.length,
    totalRevenue,
  };
}

export async function getPersonaCustomers(
  supabase: SupabaseClient,
  personaName: string,
  companyId?: string,
): Promise<{ companyId: string; personaName: string; personas: PersonaDistributionRow[]; customers: PersonaCustomerRow[]; }> {
  const company = await ensureCompanyRow(supabase, companyId);
  const customers = await fetchCustomers(supabase);
  const metricsByCustomer = await fetchMetricsByCustomer(supabase);
  const attributesByCustomer = await fetchAttributesByCustomer(supabase);
  const profiles = buildProfiles(customers, metricsByCustomer, attributesByCustomer);
  const persistedRows = await fetchPersonaRows(supabase, company.id);
  const distribution = buildDistribution(persistedRows, profiles);

  const selectedRows = persistedRows.filter((row) => row.persona_name === personaName);
  const selectedCustomers = selectedRows.map((row) => {
    const profile = profiles.find((candidate) => candidate.customerId === row.customer_id);

    return {
      customer_id: row.customer_id,
      customer_name: profile?.customerName ?? '',
      total_spent: profile?.totalSpent ?? 0,
      total_orders: profile?.totalOrders ?? 0,
      avg_order_value: profile?.avgOrderValue ?? 0,
      days_since_last_order: profile?.daysSinceLastOrder ?? null,
      favorite_category: profile?.favoriteCategory ?? null,
      second_favorite_category: profile?.secondFavoriteCategory ?? null,
      preferred_channel: profile?.preferredChannel ?? null,
      discount_affinity: profile?.discountAffinity ?? null,
      dominant_price_band: profile?.dominantPriceBand ?? null,
      category_diversity_score: profile?.categoryDiversityScore ?? null,
      persona_name: row.persona_name,
      persona_description: row.persona_description,
      confidence_score: toNumber(row.confidence_score),
    };
  });

  return {
    companyId: company.id,
    personaName,
    personas: distribution,
    customers: selectedCustomers,
  };
}

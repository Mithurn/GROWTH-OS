import OpenAI from 'openai';
import type { SupabaseClient } from '@supabase/supabase-js';
import { openRouterConfig } from '../config/openrouter';
import { logger } from '../lib/logger';

export type OpportunityStatus =
  | 'Detected'
  | 'Accepted'
  | 'Rejected'
  | 'Campaign Created'
  | 'Completed'
  | 'Archived';

export interface OpportunityLogger {
  info: (message: string, ...args: unknown[]) => void;
  warn: (message: string, ...args: unknown[]) => void;
  error: (message: string, ...args: unknown[]) => void;
}

export interface OpportunityRecord {
  id?: string;
  company_id: string;
  opportunity_key: string;
  opportunity_type: string;
  title: string;
  description: string;
  audience_size: number;
  potential_revenue: number;
  confidence_score: number;
  priority_score: number;
  supporting_customer_segment: string;
  recommended_action: string;
  audience_definition: Record<string, unknown>;
  trigger_reason: string;
  ai_summary: string;
  predicted_conversion_rate?: number | null;
  alternative_strategies?: unknown[] | null;
  opportunity_personas?: unknown[] | null;
  status: OpportunityStatus;
  updated_at?: string;
}

export interface OpportunityCustomerRecord {
  opportunity_id: string;
  customer_id: string;
}

export interface OpportunityCustomerDetail {
  customer_id: string;
  customer_name: string;
  total_spent: number;
  total_orders: number;
  avg_order_value: number;
  last_order_date: string | null;
  days_since_last_order: number | null;
  favorite_category: string | null;
  second_favorite_category: string | null;
  preferred_channel: string | null;
  discount_affinity: string | null;
  dominant_price_band: string | null;
  category_diversity_score: number | null;
  persona_name: string | null;
  persona_description: string | null;
  confidence_score: number | null;
}

export interface OpportunityDistributionRow {
  opportunity_id: string;
  opportunity_key: string;
  opportunity_type: string;
  title: string;
  description: string;
  audience_size: number;
  potential_revenue: number;
  confidence_score: number;
  priority_score: number;
  supporting_customer_segment: string;
  recommended_action: string;
  audience_definition: Record<string, unknown>;
  trigger_reason: string;
  ai_summary: string;
  predicted_conversion_rate?: number | null;
  alternative_strategies?: Array<{ title: string; conversion_rate: number; note: string }> | null;
  opportunity_personas?: Array<{ name: string; description: string }> | null;
  status: OpportunityStatus;
  customer_count: number;
  average_spend: number;
  average_orders: number;
  revenue_share: number;
}

export interface OpportunityReport {
  generatedAt: string;
  companyId: string;
  totalCustomers: number;
  totalOpportunities: number;
  totalRevenuePotential: number;
  topOpportunities: OpportunityDistributionRow[];
  opportunityDistribution: OpportunityDistributionRow[];
  validation: OpportunityValidationSummary;
}

export interface OpportunityValidationSummary {
  everyOpportunityHasAudience: boolean;
  everyOpportunityHasSummary: boolean;
  confidenceScoresPopulated: boolean;
  opportunityCountReasonable: boolean;
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

interface PersonaRow {
  customer_id: string;
  persona_name: string;
  persona_description: string;
  confidence_score: number | string;
}

interface OrderRow {
  id: string;
  customer_id: string;
  order_date: string;
}

interface OrderItemRow {
  order_id: string;
  product_id: string;
}

interface ProductRow {
  id: string;
  category: string | null;
}

interface CompanyRow {
  id: string;
  company_name: string;
  industry: string | null;
}

interface CustomerProfile {
  customerId: string;
  customerName: string;
  totalOrders: number;
  totalSpent: number;
  avgOrderValue: number;
  lastOrderDate: string | null;
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
  personaName: string | null;
  personaDescription: string | null;
  personaConfidence: number | null;
  purchasedCategories: Set<string>;
  quarterCounts: Map<string, number>;
  peakQuarter: string | null;
  peakQuarterShare: number;
}

interface OpportunityDraft {
  opportunity_key: string;
  opportunity_type: string;
  title: string;
  description: string;
  audience_size: number;
  potential_revenue: number;
  confidence_score: number;
  priority_score: number;
  supporting_customer_segment: string;
  recommended_action: string;
  audience_definition: Record<string, unknown>;
  trigger_reason: string;
  ai_summary: string;
  predicted_conversion_rate?: number;
  alternative_strategies?: Array<{ title: string; conversion_rate: number; note: string }>;
  opportunity_personas?: Array<{ name: string; description: string }>;
  status: OpportunityStatus;
  audience_customer_ids: string[];
}

interface GenerateOpportunityOptions {
  companyId?: string;
  model?: string;
  logger?: OpportunityLogger;
}

interface AIOpportunitySummary {
  ai_summary: string;
  predicted_conversion_rate?: number;
  alternative_strategies?: Array<{ title: string; conversion_rate: number; note: string }>;
  opportunity_personas?: Array<{ name: string; description: string }>;
}

const defaultLogger: OpportunityLogger = {
  info:  (msg, ...args) => logger.info(args[0] ?? {}, msg),
  warn:  (msg, ...args) => logger.warn(args[0] ?? {}, msg),
  error: (msg, ...args) => logger.error(args[0] ?? {}, msg),
};

const QUARTER_LABELS = ['Q1', 'Q2', 'Q3', 'Q4'] as const;
const CROSS_SELL_RULES = [
  {
    sourceCategory: "Women's Kurtas",
    targetCategory: 'Dupattas',
    title: 'Cross-Sell Dupattas to Kurta Buyers',
    description: 'Customers who buy women’s kurtas often convert on matching dupattas.',
    recommendedAction: 'Recommend dupatta add-ons in follow-up outreach.',
  },
  {
    sourceCategory: 'Sarees',
    targetCategory: 'Jewelry',
    title: 'Cross-Sell Jewelry to Saree Buyers',
    description: 'Saree buyers have a natural affinity for jewelry add-ons.',
    recommendedAction: 'Promote jewelry bundles to saree customers.',
  },
  {
    sourceCategory: "Men's Kurtas",
    targetCategory: 'Footwear',
    title: 'Cross-Sell Footwear to Kurta Buyers',
    description: 'Men’s kurta buyers often respond to footwear add-ons.',
    recommendedAction: 'Recommend ethnic footwear alongside kurta purchases.',
  },
  {
    sourceCategory: 'Handbags',
    targetCategory: 'Jewelry',
    title: 'Cross-Sell Jewelry to Handbag Buyers',
    description: 'Handbag buyers are strong candidates for jewelry bundles.',
    recommendedAction: 'Offer jewelry as a complementary accessory.',
  },
];

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

function buildCustomerName(customer: CustomerRow): string {
  const lastName = customer.last_name?.trim();
  return lastName ? `${customer.first_name} ${lastName}` : customer.first_name;
}

function toDateKey(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length >= 10 ? trimmed.slice(0, 10) : null;
}

function getQuarter(dateValue: string | null): string | null {
  if (!dateValue) return null;
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return null;
  const month = date.getMonth();
  const quarterIndex = Math.floor(month / 3);
  return QUARTER_LABELS[quarterIndex] ?? null;
}

function formatCurrency(value: number): string {
  return `₹${Math.round(value).toLocaleString('en-IN')}`;
}

function normalizeConfidence(value: number | string | null | undefined): number {
  const parsed = toNumber(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return 0.5;
  if (parsed > 1) return roundToTwo(Math.max(0, Math.min(1, parsed / 100)));
  return roundToTwo(Math.max(0, Math.min(1, parsed)));
}

async function ensureCompanyRow(supabase: SupabaseClient, companyId?: string): Promise<CompanyRow> {
  if (companyId) {
    const { data, error } = await supabase
      .from('companies')
      .select('id, company_name, industry')
      .eq('id', companyId)
      .maybeSingle();

    if (error) throw new Error(`Failed to load company ${companyId}: ${error.message}`);
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
    .upsert(
      {
        company_name: 'GrowthOS Demo Fashion',
        industry: 'Fashion',
      },
      { onConflict: 'company_name' },
    )
    .select('id, company_name, industry')
    .single();

  if (insertError) {
    throw new Error(`Failed to create default company row: ${insertError.message}`);
  }

  return inserted as CompanyRow;
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

async function fetchMetrics(supabase: SupabaseClient): Promise<Map<string, MetricRow>> {
  const { data, error } = await supabase
    .from('customer_metrics')
    .select('customer_id, total_orders, total_spent, avg_order_value, last_order_date, days_since_last_order, purchase_frequency, engagement_score');

  if (error) {
    throw new Error(`Failed to load customer metrics: ${error.message}`);
  }

  return new Map((data ?? []).map((row) => [row.customer_id, row as MetricRow]));
}

async function fetchAttributes(supabase: SupabaseClient): Promise<Map<string, AttributeRow>> {
  const { data, error } = await supabase
    .from('customer_attributes')
    .select('customer_id, favorite_category, second_favorite_category, preferred_channel, discount_affinity, avg_days_between_orders, dominant_price_band, category_diversity_score');

  if (error) {
    throw new Error(`Failed to load customer attributes: ${error.message}`);
  }

  return new Map((data ?? []).map((row) => [row.customer_id, row as AttributeRow]));
}

async function fetchPersonas(supabase: SupabaseClient): Promise<Map<string, PersonaRow>> {
  const { data, error } = await supabase
    .from('personas')
    .select('customer_id, persona_name, persona_description, confidence_score');

  if (error) {
    throw new Error(`Failed to load personas: ${error.message}`);
  }

  return new Map((data ?? []).map((row) => [row.customer_id, row as PersonaRow]));
}

async function fetchOrders(supabase: SupabaseClient): Promise<OrderRow[]> {
  const { data, error } = await supabase
    .from('orders')
    .select('id, customer_id, order_date');

  if (error) {
    throw new Error(`Failed to load orders: ${error.message}`);
  }

  return (data ?? []) as OrderRow[];
}

async function fetchOrderItems(supabase: SupabaseClient): Promise<OrderItemRow[]> {
  const { data, error } = await supabase
    .from('order_items')
    .select('order_id, product_id');

  if (error) {
    throw new Error(`Failed to load order items: ${error.message}`);
  }

  return (data ?? []) as OrderItemRow[];
}

async function fetchProducts(supabase: SupabaseClient): Promise<Map<string, ProductRow>> {
  const { data, error } = await supabase
    .from('products')
    .select('id, category');

  if (error) {
    throw new Error(`Failed to load products: ${error.message}`);
  }

  return new Map((data ?? []).map((row) => [row.id, row as ProductRow]));
}

function buildProfiles(
  customers: CustomerRow[],
  metricsByCustomer: Map<string, MetricRow>,
  attributesByCustomer: Map<string, AttributeRow>,
  personasByCustomer: Map<string, PersonaRow>,
  orders: OrderRow[],
  orderItems: OrderItemRow[],
  productsById: Map<string, ProductRow>,
): CustomerProfile[] {
  const orderById = new Map(orders.map((order) => [order.id, order]));
  const customerCategorySets = new Map<string, Set<string>>();
  const customerQuarterCounts = new Map<string, Map<string, number>>();

  for (const item of orderItems) {
    const order = orderById.get(item.order_id);
    if (!order) continue;

    const product = productsById.get(item.product_id);
    if (!product?.category) continue;

    const categories = customerCategorySets.get(order.customer_id) ?? new Set<string>();
    categories.add(product.category);
    customerCategorySets.set(order.customer_id, categories);

    const quarterCounts = customerQuarterCounts.get(order.customer_id) ?? new Map<string, number>();
    const quarter = getQuarter(toDateKey(order.order_date));
    if (quarter) {
      quarterCounts.set(quarter, (quarterCounts.get(quarter) ?? 0) + 1);
      customerQuarterCounts.set(order.customer_id, quarterCounts);
    }
  }

  return customers.map((customer) => {
    const metrics = metricsByCustomer.get(customer.id);
    const attributes = attributesByCustomer.get(customer.id);
    const persona = personasByCustomer.get(customer.id);
    const totalOrders = toNumber(metrics?.total_orders);
    const totalSpent = roundToTwo(toNumber(metrics?.total_spent));
    const avgOrderValue = roundToTwo(toNumber(metrics?.avg_order_value));
    const daysSinceLastOrder = metrics?.days_since_last_order === null || metrics?.days_since_last_order === undefined
      ? null
      : Math.max(0, Math.trunc(toNumber(metrics.days_since_last_order)));
    const quarterCounts = customerQuarterCounts.get(customer.id) ?? new Map<string, number>();
    const quarterEntries = [...quarterCounts.entries()].sort((a, b) => b[1] - a[1]);
    const peakQuarter = quarterEntries[0]?.[0] ?? null;
    const peakQuarterShare = totalOrders > 0 && quarterEntries.length > 0
      ? roundToTwo((quarterEntries[0][1] / totalOrders) * 100)
      : 0;

    return {
      customerId: customer.id,
      customerName: buildCustomerName(customer),
      totalOrders,
      totalSpent,
      avgOrderValue,
      lastOrderDate: metrics?.last_order_date ?? null,
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
      personaName: persona?.persona_name ?? null,
      personaDescription: persona?.persona_description ?? null,
      personaConfidence: persona?.confidence_score === null || persona?.confidence_score === undefined
        ? null
        : normalizeConfidence(persona.confidence_score),
      purchasedCategories: customerCategorySets.get(customer.id) ?? new Set<string>(),
      quarterCounts,
      peakQuarter,
      peakQuarterShare,
    };
  });
}

function getDominantPersona(customers: CustomerProfile[]): string {
  const counts = new Map<string, number>();
  for (const customer of customers) {
    if (!customer.personaName) continue;
    counts.set(customer.personaName, (counts.get(customer.personaName) ?? 0) + 1);
  }

  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'Customer Intelligence';
}

function chooseBestChannel(customers: CustomerProfile[]): string {
  const counts = new Map<string, number>();
  for (const customer of customers) {
    const channel = customer.preferredChannel ?? 'Unknown';
    counts.set(channel, (counts.get(channel) ?? 0) + 1);
  }

  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'WhatsApp';
}

function buildDormantVipOpportunity(customers: CustomerProfile[]): OpportunityDraft | null {
  const audience = customers.filter((customer) =>
    customer.totalOrders > 0 &&
    customer.totalSpent >= 5000 &&
    (customer.daysSinceLastOrder ?? 0) >= 90,
  );

  if (audience.length === 0) return null;

  const averageAov = audience.reduce((sum, customer) => sum + customer.avgOrderValue, 0) / audience.length;
  const potentialRevenue = audience.length * averageAov * 0.18;
  const confidence = roundToTwo(Math.min(0.98, 0.72 + (audience.length / Math.max(1, customers.length)) * 0.2));

  return {
    opportunity_key: 'dormant_vip_recovery_90d_5000',
    opportunity_type: 'Dormant VIP Recovery',
    title: 'Recover Dormant VIP Customers',
    description: 'High-value customers who have not purchased in 90+ days and are likely to respond to a win-back push.',
    audience_size: audience.length,
    potential_revenue: roundToTwo(potentialRevenue),
    confidence_score: roundToTwo(confidence * 100),
    priority_score: 0,
    supporting_customer_segment: getDominantPersona(audience),
    recommended_action: `Launch a win-back campaign on ${chooseBestChannel(audience)}.`,
    audience_definition: {
      total_spent: '>= 5000',
      days_since_last_order: '>= 90',
    },
    trigger_reason: `${audience.length} high-value customers crossed the 90-day inactivity threshold.`,
    ai_summary: '',
    status: 'Detected',
    audience_customer_ids: audience.map((customer) => customer.customerId),
  };
}

function buildChurnRiskOpportunity(customers: CustomerProfile[]): OpportunityDraft | null {
  const audience = customers.filter((customer) => {
    if (customer.totalOrders < 3) return false;
    if (customer.daysSinceLastOrder === null || customer.avgDaysBetweenOrders === null) return false;
    const threshold = Math.max(45, customer.avgDaysBetweenOrders * 2);
    return customer.daysSinceLastOrder >= threshold && customer.totalSpent >= 5000;
  });

  if (audience.length === 0) return null;

  const averageAov = audience.reduce((sum, customer) => sum + customer.avgOrderValue, 0) / audience.length;
  const potentialRevenue = audience.length * averageAov * 0.12;
  const avgGap = audience.reduce((sum, customer) => sum + (customer.avgDaysBetweenOrders ?? 0), 0) / audience.length;
  const confidence = roundToTwo(Math.min(0.95, 0.68 + (audience.length / Math.max(1, customers.length)) * 0.15));

  return {
    opportunity_key: 'churn_risk_high_frequency_gap',
    opportunity_type: 'Churn Risk Customers',
    title: 'Prevent Churn Among High-Frequency Buyers',
    description: 'Customers whose purchase cadence has slowed significantly compared with their historical pattern.',
    audience_size: audience.length,
    potential_revenue: roundToTwo(potentialRevenue),
    confidence_score: roundToTwo(confidence * 100),
    priority_score: 0,
    supporting_customer_segment: getDominantPersona(audience),
    recommended_action: `Send a retention message on ${chooseBestChannel(audience)} before the next expected reorder window.`,
    audience_definition: {
      total_orders: '>= 3',
      days_since_last_order: '>= max(45, avg_days_between_orders * 2)',
    },
    trigger_reason: `${audience.length} customers are significantly overdue versus their historical reorder cadence (avg gap ${roundToTwo(avgGap)} days).`,
    ai_summary: '',
    status: 'Detected',
    audience_customer_ids: audience.map((customer) => customer.customerId),
  };
}

function buildVipRewardOpportunity(customers: CustomerProfile[]): OpportunityDraft | null {
  const sortedBySpend = [...customers].sort((a, b) => b.totalSpent - a.totalSpent);
  const thresholdIndex = Math.max(1, Math.ceil(sortedBySpend.length * 0.1));
  const audience = sortedBySpend.slice(0, thresholdIndex).filter((customer) => customer.totalOrders > 0);

  if (audience.length === 0) return null;

  const averageAov = audience.reduce((sum, customer) => sum + customer.avgOrderValue, 0) / audience.length;
  const potentialRevenue = audience.length * averageAov * 0.08;
  const revenueShare = audience.reduce((sum, customer) => sum + customer.totalSpent, 0) / Math.max(1, customers.reduce((sum, customer) => sum + customer.totalSpent, 0));
  const confidence = roundToTwo(Math.min(0.97, 0.75 + revenueShare * 0.2));

  return {
    opportunity_key: 'vip_reward_top10_spend',
    opportunity_type: 'VIP Reward Opportunity',
    title: 'Reward Top VIP Customers',
    description: 'Top-spending customers who deserve exclusivity, retention, and reward messaging.',
    audience_size: audience.length,
    potential_revenue: roundToTwo(potentialRevenue),
    confidence_score: roundToTwo(confidence * 100),
    priority_score: 0,
    supporting_customer_segment: getDominantPersona(audience),
    recommended_action: `Offer exclusive early access and rewards via ${chooseBestChannel(audience)}.`,
    audience_definition: {
      lifetime_spend_percentile: 'Top 10%',
    },
    trigger_reason: `${audience.length} customers account for a large share of revenue and are ideal for loyalty reinforcement.`,
    ai_summary: '',
    status: 'Detected',
    audience_customer_ids: audience.map((customer) => customer.customerId),
  };
}

function buildSeasonalOpportunity(customers: CustomerProfile[]): OpportunityDraft | null {
  const audience = customers.filter((customer) =>
    customer.totalOrders >= 2 &&
    customer.peakQuarter !== null &&
    customer.peakQuarterShare >= 60 &&
    (customer.daysSinceLastOrder ?? 0) >= 60,
  );

  if (audience.length === 0) return null;

  const averageAov = audience.reduce((sum, customer) => sum + customer.avgOrderValue, 0) / audience.length;
  const potentialRevenue = audience.length * averageAov * 0.14;
  const confidence = roundToTwo(Math.min(0.94, 0.7 + (audience.length / Math.max(1, customers.length)) * 0.18));
  const peakQuarter = audience[0]?.peakQuarter ?? 'Q4';

  return {
    opportunity_key: `seasonal_reengagement_${peakQuarter.toLowerCase()}`,
    opportunity_type: 'Seasonal Opportunity',
    title: 'Re-Engage Seasonal Buyers',
    description: 'Customers whose buying behavior clusters around a seasonal quarter and who are now inactive.',
    audience_size: audience.length,
    potential_revenue: roundToTwo(potentialRevenue),
    confidence_score: roundToTwo(confidence * 100),
    priority_score: 0,
    supporting_customer_segment: getDominantPersona(audience),
    recommended_action: `Trigger a seasonal re-engagement message on ${chooseBestChannel(audience)}.`,
    audience_definition: {
      total_orders: '>= 2',
      peak_quarter_share: '>= 60%',
      days_since_last_order: '>= 60',
    },
    trigger_reason: `${audience.length} customers buy in recurring seasonal bursts, especially in ${peakQuarter}.`,
    ai_summary: '',
    status: 'Detected',
    audience_customer_ids: audience.map((customer) => customer.customerId),
  };
}

function buildCrossSellOpportunity(customers: CustomerProfile[]): OpportunityDraft | null {
  const rules = CROSS_SELL_RULES.map((rule) => {
    const audience = customers.filter((customer) =>
      customer.purchasedCategories.has(rule.sourceCategory) &&
      !customer.purchasedCategories.has(rule.targetCategory),
    );

    const averageAov = audience.reduce((sum, customer) => sum + customer.avgOrderValue, 0) / Math.max(1, audience.length);
    return {
      ...rule,
      audience,
      averageAov,
      potentialRevenue: audience.length * averageAov * 0.1,
    };
  }).filter((rule) => rule.audience.length > 0);

  if (rules.length === 0) return null;

  const bestRule = rules.sort((a, b) => b.potentialRevenue - a.potentialRevenue)[0];
  if (!bestRule) return null;

  const confidence = roundToTwo(Math.min(0.93, 0.66 + (bestRule.audience.length / Math.max(1, customers.length)) * 0.2));

  return {
    opportunity_key: `cross_sell_${bestRule.sourceCategory.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_to_${bestRule.targetCategory.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`,
    opportunity_type: 'Cross-Sell Opportunity',
    title: bestRule.title,
    description: bestRule.description,
    audience_size: bestRule.audience.length,
    potential_revenue: roundToTwo(bestRule.potentialRevenue),
    confidence_score: roundToTwo(confidence * 100),
    priority_score: 0,
    supporting_customer_segment: getDominantPersona(bestRule.audience),
    recommended_action: bestRule.recommendedAction,
    audience_definition: {
      purchased_category: bestRule.sourceCategory,
      never_purchased_category: bestRule.targetCategory,
    },
    trigger_reason: `${bestRule.audience.length} customers bought ${bestRule.sourceCategory} but have never purchased ${bestRule.targetCategory}.`,
    ai_summary: '',
    status: 'Detected',
    audience_customer_ids: bestRule.audience.map((customer) => customer.customerId),
  };
}

function assignPriorityScores(opportunities: OpportunityDraft[]): OpportunityDraft[] {
  const maxRevenue = Math.max(...opportunities.map((opportunity) => opportunity.potential_revenue), 1);
  const maxAudience = Math.max(...opportunities.map((opportunity) => opportunity.audience_size), 1);

  return opportunities.map((opportunity) => {
    const revenueScore = (opportunity.potential_revenue / maxRevenue) * 100;
    const audienceScore = (opportunity.audience_size / maxAudience) * 100;
    const priorityScore = (revenueScore * 0.45) + (audienceScore * 0.25) + (opportunity.confidence_score * 0.30);

    return {
      ...opportunity,
      priority_score: roundToTwo(priorityScore),
    };
  }).sort((a, b) => b.priority_score - a.priority_score);
}

function buildOpportunityPrompt(opportunity: OpportunityDraft, sampleCustomers: OpportunityCustomerDetail[]): string {
  return [
    'You are a retail CRM strategist. Analyze the opportunity below and return a single JSON object with exactly these keys:',
    '- ai_summary: 2-3 sentence marketer-friendly explanation of why this opportunity matters.',
    '- predicted_conversion_rate: A realistic number (e.g. 14.5) representing expected conversion percentage for the recommended action.',
    '- alternative_strategies: Array of exactly 2 objects, each with {title: string, conversion_rate: number, note: string} describing alternative approaches and their expected conversion rates.',
    '- opportunity_personas: Array of up to 3 objects {name: string, description: string} describing the customer personas most relevant to this opportunity.',
    'Return JSON only. No markdown fences.',
    '',
    `Opportunity Type: ${opportunity.opportunity_type}`,
    `Title: ${opportunity.title}`,
    `Description: ${opportunity.description}`,
    `Trigger Reason: ${opportunity.trigger_reason}`,
    `Audience Size: ${opportunity.audience_size}`,
    `Potential Revenue: ${formatCurrency(opportunity.potential_revenue)}`,
    `Confidence Score: ${opportunity.confidence_score}`,
    `Recommended Action: ${opportunity.recommended_action}`,
    `Supporting Customer Segment: ${opportunity.supporting_customer_segment}`,
    'Sample customers:',
    JSON.stringify(sampleCustomers.slice(0, 3), null, 2),
  ].join('\n');
}

async function generateAiEnrichment(
  client: OpenAI,
  model: string,
  opportunity: OpportunityDraft,
  sampleCustomers: OpportunityCustomerDetail[],
): Promise<AIOpportunitySummary> {
  const response = await client.chat.completions.create({
    model,
    temperature: 0.2,
    max_tokens: 600,
    messages: [
      {
        role: 'system',
        content: 'You output only valid JSON and never include markdown.',
      },
      {
        role: 'user',
        content: buildOpportunityPrompt(opportunity, sampleCustomers),
      },
    ],
  });

  const raw = response.choices[0]?.message?.content ?? '';
  try {
    const parsed = JSON.parse(raw) as AIOpportunitySummary;
    if (!parsed.ai_summary?.trim()) {
      throw new Error('Missing ai_summary');
    }
    return {
      ai_summary: parsed.ai_summary.trim(),
      predicted_conversion_rate: typeof parsed.predicted_conversion_rate === 'number' ? parsed.predicted_conversion_rate : undefined,
      alternative_strategies: Array.isArray(parsed.alternative_strategies) ? parsed.alternative_strategies : undefined,
      opportunity_personas: Array.isArray(parsed.opportunity_personas) ? parsed.opportunity_personas : undefined,
    };
  } catch {
    throw new Error('Opportunity model returned invalid JSON');
  }
}

function fallbackAiSummary(opportunity: OpportunityDraft): string {
  return `${opportunity.audience_size} customers match this opportunity. Estimated recoverable revenue is ${formatCurrency(opportunity.potential_revenue)}. Trigger: ${opportunity.trigger_reason}`;
}

function buildDistribution(
  opportunities: Array<OpportunityRecord & { id: string }>,
  customerDetailsByOpportunity: Map<string, OpportunityCustomerDetail[]>,
  totalRevenuePotential: number,
): OpportunityDistributionRow[] {
  return opportunities
    .map((opportunity) => {
      const audience = customerDetailsByOpportunity.get(opportunity.id) ?? [];
      const avgSpend = audience.length > 0 ? audience.reduce((sum, customer) => sum + customer.total_spent, 0) / audience.length : 0;
      const avgOrders = audience.length > 0 ? audience.reduce((sum, customer) => sum + customer.total_orders, 0) / audience.length : 0;

      return {
        opportunity_id: opportunity.id,
        opportunity_key: opportunity.opportunity_key,
        opportunity_type: opportunity.opportunity_type,
        title: opportunity.title,
        description: opportunity.description,
        audience_size: opportunity.audience_size,
        potential_revenue: roundToTwo(opportunity.potential_revenue),
        confidence_score: roundToTwo(opportunity.confidence_score),
        priority_score: roundToTwo(opportunity.priority_score),
        supporting_customer_segment: opportunity.supporting_customer_segment,
        recommended_action: opportunity.recommended_action,
        audience_definition: opportunity.audience_definition,
        trigger_reason: opportunity.trigger_reason,
        ai_summary: opportunity.ai_summary,
        predicted_conversion_rate: (opportunity.predicted_conversion_rate ?? null) as number | null,
        alternative_strategies: (opportunity.alternative_strategies ?? null) as Array<{ title: string; conversion_rate: number; note: string }> | null,
        opportunity_personas: (opportunity.opportunity_personas ?? null) as Array<{ name: string; description: string }> | null,
        status: opportunity.status,
        customer_count: audience.length,
        average_spend: roundToTwo(avgSpend),
        average_orders: roundToTwo(avgOrders),
        revenue_share: totalRevenuePotential > 0 ? roundToTwo((opportunity.potential_revenue / totalRevenuePotential) * 100) : 0,
      };
    })
    .sort((a, b) => b.priority_score - a.priority_score || b.potential_revenue - a.potential_revenue);
}

function buildOpportunityCandidates(customers: CustomerProfile[]): OpportunityDraft[] {
  const dormantVip = buildDormantVipOpportunity(customers);
  const churnRisk = buildChurnRiskOpportunity(customers);
  const vipReward = buildVipRewardOpportunity(customers);
  const seasonal = buildSeasonalOpportunity(customers);
  const crossSell = buildCrossSellOpportunity(customers);

  return [dormantVip, churnRisk, crossSell, vipReward, seasonal].filter((item): item is OpportunityDraft => item !== null);
}

async function enrichWithAiSummaries(
  client: OpenAI,
  model: string,
  opportunities: OpportunityDraft[],
  customerDetailsByOpportunity: Map<string, OpportunityCustomerDetail[]>,
  logger: OpportunityLogger,
): Promise<OpportunityDraft[]> {
  const enriched: OpportunityDraft[] = [];

  for (const opportunity of opportunities) {
    const sampleCustomers = customerDetailsByOpportunity.get(opportunity.opportunity_key) ?? [];
    try {
      const enrichment = await generateAiEnrichment(client, model, opportunity, sampleCustomers);
      enriched.push({ ...opportunity, ...enrichment });
      logger.info(`[opportunities] AI enrichment generated for ${opportunity.title}`);
    } catch (error) {
      logger.warn(`[opportunities] Falling back to deterministic summary for ${opportunity.title}`, error);
      enriched.push({ ...opportunity, ai_summary: fallbackAiSummary(opportunity) });
    }
  }

  return enriched;
}

async function buildCustomerDetailsByOpportunity(
  supabase: SupabaseClient,
  opportunities: OpportunityDraft[],
): Promise<Map<string, OpportunityCustomerDetail[]>> {
  const details = new Map<string, OpportunityCustomerDetail[]>();

  for (const opportunity of opportunities) {
    const customerIds = opportunity.audience_customer_ids;
    if (customerIds.length === 0) {
      details.set(opportunity.opportunity_key, []);
      continue;
    }

    const [customersResult, metricsResult, attributesResult, personasResult] = await Promise.all([
      supabase.from('customers').select('id, first_name, last_name').in('id', customerIds),
      supabase.from('customer_metrics').select('customer_id, total_spent, total_orders, avg_order_value, last_order_date, days_since_last_order, engagement_score').in('customer_id', customerIds),
      supabase.from('customer_attributes').select('customer_id, favorite_category, second_favorite_category, preferred_channel, discount_affinity, dominant_price_band, category_diversity_score').in('customer_id', customerIds),
      supabase.from('personas').select('customer_id, persona_name, persona_description, confidence_score').in('customer_id', customerIds),
    ]);

    if (customersResult.error) throw new Error(`Failed to load opportunity customers: ${customersResult.error.message}`);
    if (metricsResult.error) throw new Error(`Failed to load opportunity metrics: ${metricsResult.error.message}`);
    if (attributesResult.error) throw new Error(`Failed to load opportunity attributes: ${attributesResult.error.message}`);
    if (personasResult.error) throw new Error(`Failed to load opportunity personas: ${personasResult.error.message}`);

    const customerById = new Map((customersResult.data ?? []).map((row: any) => [row.id, row]));
    const metricsById = new Map((metricsResult.data ?? []).map((row: any) => [row.customer_id, row]));
    const attributesById = new Map((attributesResult.data ?? []).map((row: any) => [row.customer_id, row]));
    const personasById = new Map((personasResult.data ?? []).map((row: any) => [row.customer_id, row]));

    const audience = customerIds.map((customerId) => {
      const customer = customerById.get(customerId);
      const metrics = metricsById.get(customerId);
      const attributes = attributesById.get(customerId);
      const persona = personasById.get(customerId);

      return {
        customer_id: customerId,
        customer_name: customer ? buildCustomerName(customer) : '',
        total_spent: roundToTwo(toNumber(metrics?.total_spent)),
        total_orders: toNumber(metrics?.total_orders),
        avg_order_value: roundToTwo(toNumber(metrics?.avg_order_value)),
        last_order_date: metrics?.last_order_date ?? null,
        days_since_last_order: metrics?.days_since_last_order === null || metrics?.days_since_last_order === undefined
          ? null
          : Math.trunc(toNumber(metrics.days_since_last_order)),
        favorite_category: attributes?.favorite_category ?? null,
        second_favorite_category: attributes?.second_favorite_category ?? null,
        preferred_channel: attributes?.preferred_channel ?? null,
        discount_affinity: attributes?.discount_affinity ?? null,
        dominant_price_band: attributes?.dominant_price_band ?? null,
        category_diversity_score: attributes?.category_diversity_score === null || attributes?.category_diversity_score === undefined
          ? null
          : roundToTwo(toNumber(attributes.category_diversity_score)),
        persona_name: persona?.persona_name ?? null,
        persona_description: persona?.persona_description ?? null,
        confidence_score: persona?.confidence_score === null || persona?.confidence_score === undefined
          ? null
          : normalizeConfidence(persona.confidence_score),
      } satisfies OpportunityCustomerDetail;
    });

    details.set(opportunity.opportunity_key, audience);
  }

  return details;
}

async function countOpportunityAudience(
  supabase: SupabaseClient,
  opportunityIds: string[],
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (opportunityIds.length === 0) return counts;

  const { data, error } = await supabase
    .from('opportunity_customers')
    .select('opportunity_id')
    .in('opportunity_id', opportunityIds);

  if (error) {
    throw new Error(`Failed to count opportunity audience: ${error.message}`);
  }

  for (const row of data ?? []) {
    const opportunityId = (row as { opportunity_id: string }).opportunity_id;
    counts.set(opportunityId, (counts.get(opportunityId) ?? 0) + 1);
  }

  return counts;
}

async function upsertOpportunities(
  supabase: SupabaseClient,
  companyId: string,
  opportunities: OpportunityDraft[],
): Promise<Array<OpportunityRecord & { id: string }>> {
  const { data: existing, error: existingError } = await supabase
    .from('opportunities')
    .select('id, opportunity_key, status')
    .eq('company_id', companyId);

  if (existingError) {
    throw new Error(`Failed to inspect existing opportunities: ${existingError.message}`);
  }

  const statusByKey = new Map((existing ?? []).map((row: any) => [row.opportunity_key, row.status as OpportunityStatus]));

  const payload: OpportunityRecord[] = opportunities.map((opportunity) => ({
    company_id: companyId,
    opportunity_key: opportunity.opportunity_key,
    opportunity_type: opportunity.opportunity_type,
    title: opportunity.title,
    description: opportunity.description,
    audience_size: opportunity.audience_size,
    potential_revenue: opportunity.potential_revenue,
    confidence_score: opportunity.confidence_score,
    priority_score: opportunity.priority_score,
    supporting_customer_segment: opportunity.supporting_customer_segment,
    recommended_action: opportunity.recommended_action,
    audience_definition: opportunity.audience_definition,
    trigger_reason: opportunity.trigger_reason,
    ai_summary: opportunity.ai_summary,
    predicted_conversion_rate: opportunity.predicted_conversion_rate ?? null,
    alternative_strategies: opportunity.alternative_strategies ?? null,
    opportunity_personas: opportunity.opportunity_personas ?? null,
    status: statusByKey.get(opportunity.opportunity_key) ?? opportunity.status,
    updated_at: new Date().toISOString(),
  }));

  const { data, error } = await supabase
    .from('opportunities')
    .upsert(payload, { onConflict: 'company_id,opportunity_key' })
    .select('id, company_id, opportunity_key, opportunity_type, title, description, audience_size, potential_revenue, confidence_score, priority_score, supporting_customer_segment, recommended_action, audience_definition, trigger_reason, ai_summary, predicted_conversion_rate, alternative_strategies, opportunity_personas, status');

  if (error) {
    throw new Error(`Failed to persist opportunities: ${error.message}`);
  }

  return (data ?? []) as Array<OpportunityRecord & { id: string }>;
}

async function clearAndInsertAudience(
  supabase: SupabaseClient,
  opportunityId: string,
  customerIds: string[],
): Promise<void> {
  const { error: deleteError } = await supabase
    .from('opportunity_customers')
    .delete()
    .eq('opportunity_id', opportunityId);

  if (deleteError) {
    throw new Error(`Failed to clear opportunity audience: ${deleteError.message}`);
  }

  const payload: OpportunityCustomerRecord[] = customerIds.map((customerId) => ({
    opportunity_id: opportunityId,
    customer_id: customerId,
  }));

  if (payload.length === 0) {
    return;
  }

  const { error } = await supabase
    .from('opportunity_customers')
    .upsert(payload, { onConflict: 'opportunity_id,customer_id' });

  if (error) {
    throw new Error(`Failed to persist opportunity audience: ${error.message}`);
  }
}

export async function generateOpportunities(
  supabase: SupabaseClient,
  options: GenerateOpportunityOptions = {},
): Promise<OpportunityReport> {
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

  logger.info(`[opportunities] Starting generation for company=${company.company_name} (${company.id})`);

  const [customers, metricsByCustomer, attributesByCustomer, personasByCustomer, orders, orderItems, productsById] = await Promise.all([
    fetchCustomers(supabase),
    fetchMetrics(supabase),
    fetchAttributes(supabase),
    fetchPersonas(supabase),
    fetchOrders(supabase),
    fetchOrderItems(supabase),
    fetchProducts(supabase),
  ]);

  const profiles = buildProfiles(
    customers,
    metricsByCustomer,
    attributesByCustomer,
    personasByCustomer,
    orders,
    orderItems,
    productsById,
  );

  const candidateOpportunities = assignPriorityScores(buildOpportunityCandidates(profiles));
  logger.info(
    `[opportunities] Built ${candidateOpportunities.length} candidate opportunities from ${profiles.length} customers`,
  );

  if (candidateOpportunities.length === 0) {
    throw new Error('No opportunities could be derived from the current customer intelligence');
  }

  const customerDetailsByOpportunity = await buildCustomerDetailsByOpportunity(supabase, candidateOpportunities);
  const opportunitiesWithAi = await enrichWithAiSummaries(client, model, candidateOpportunities, customerDetailsByOpportunity, logger);
  const persistedOpportunities = await upsertOpportunities(supabase, company.id, opportunitiesWithAi);

  const opportunityIds = persistedOpportunities.map((row) => row.id);
  for (const opportunity of persistedOpportunities) {
    const matchingCandidate = opportunitiesWithAi.find((candidate) => candidate.opportunity_key === opportunity.opportunity_key);
    if (!matchingCandidate) continue;
    await clearAndInsertAudience(supabase, opportunity.id, matchingCandidate.audience_customer_ids);
  }

  const audienceCounts = await countOpportunityAudience(supabase, opportunityIds);
  const totalRevenuePotential = persistedOpportunities.reduce((sum, row) => sum + toNumber(row.potential_revenue), 0);

  const distribution = buildDistribution(
    persistedOpportunities,
    new Map(
      opportunitiesWithAi.map((candidate) => [
        persistedOpportunities.find((row) => row.opportunity_key === candidate.opportunity_key)?.id ?? candidate.opportunity_key,
        customerDetailsByOpportunity.get(candidate.opportunity_key) ?? [],
      ]),
    ),
    totalRevenuePotential,
  ).map((row) => ({
    ...row,
    customer_count: audienceCounts.get(row.opportunity_id) ?? row.customer_count,
  }));

  const validation: OpportunityValidationSummary = {
    everyOpportunityHasAudience: distribution.every((row) => row.customer_count > 0),
    everyOpportunityHasSummary: distribution.every((row) => row.ai_summary.trim().length > 0),
    confidenceScoresPopulated: distribution.every((row) => row.confidence_score > 0),
    opportunityCountReasonable: distribution.length >= 3 && distribution.length <= 6,
  };

  logger.info(
    `[opportunities] Generation complete. customers=${profiles.length}, opportunities=${distribution.length}, total_revenue_potential=${formatCurrency(totalRevenuePotential)}`,
  );
  logger.info('[opportunities] Opportunity distribution:', distribution);

  return {
    generatedAt: new Date().toISOString(),
    companyId: company.id,
    totalCustomers: profiles.length,
    totalOpportunities: distribution.length,
    totalRevenuePotential,
    topOpportunities: distribution,
    opportunityDistribution: distribution,
    validation,
  };
}

export async function getOpportunityDashboard(
  supabase: SupabaseClient,
  companyId?: string,
): Promise<OpportunityReport> {
  const company = await ensureCompanyRow(supabase, companyId);
  const [customers, opportunitiesResult] = await Promise.all([
    fetchCustomers(supabase),
    supabase
      .from('opportunities')
      .select('id, company_id, opportunity_key, opportunity_type, title, description, audience_size, potential_revenue, confidence_score, priority_score, supporting_customer_segment, recommended_action, audience_definition, trigger_reason, ai_summary, predicted_conversion_rate, alternative_strategies, opportunity_personas, status')
      .eq('company_id', company.id)
      .order('priority_score', { ascending: false }),
  ]);

  if (opportunitiesResult.error) {
    throw new Error(`Failed to load opportunities: ${opportunitiesResult.error.message}`);
  }

  const opportunities = (opportunitiesResult.data ?? []) as Array<OpportunityRecord & { id: string }>;
  const opportunityIds = opportunities.map((row) => row.id);
  const totalRevenuePotential = opportunities.reduce((sum, row) => sum + toNumber(row.potential_revenue), 0);

  const counts = new Map<string, number>();
  if (opportunityIds.length > 0) {
    const { data: audienceData, error: audienceError } = await supabase
      .from('opportunity_customers')
      .select('opportunity_id')
      .in('opportunity_id', opportunityIds);

    if (audienceError) {
      throw new Error(`Failed to load opportunity audience: ${audienceError.message}`);
    }

    for (const row of audienceData ?? []) {
      const opportunityId = (row as { opportunity_id: string }).opportunity_id;
      counts.set(opportunityId, (counts.get(opportunityId) ?? 0) + 1);
    }
  }

  const metricsByCustomer = await fetchMetrics(supabase);
  const attributesByCustomer = await fetchAttributes(supabase);
  const personasByCustomer = await fetchPersonas(supabase);
  const orderItems = await fetchOrderItems(supabase);
  const orders = await fetchOrders(supabase);
  const productsById = await fetchProducts(supabase);
  const profiles = buildProfiles(customers, metricsByCustomer, attributesByCustomer, personasByCustomer, orders, orderItems, productsById);
  const customerDetailsByOpportunity = new Map<string, OpportunityCustomerDetail[]>();

  for (const opportunity of opportunities) {
    const { data: customerIdsData, error } = await supabase
      .from('opportunity_customers')
      .select('customer_id')
      .eq('opportunity_id', opportunity.id);

    if (error) {
      throw new Error(`Failed to load audience for opportunity ${opportunity.id}: ${error.message}`);
    }

    const customerIds = (customerIdsData ?? []).map((row: any) => row.customer_id);
    const audience = customerIds
      .map((customerId) => profiles.find((profile) => profile.customerId === customerId))
      .filter((profile): profile is CustomerProfile => Boolean(profile))
      .map((profile) => ({
        customer_id: profile.customerId,
        customer_name: profile.customerName,
        total_spent: profile.totalSpent,
        total_orders: profile.totalOrders,
        avg_order_value: profile.avgOrderValue,
        last_order_date: profile.lastOrderDate,
        days_since_last_order: profile.daysSinceLastOrder,
        favorite_category: profile.favoriteCategory,
        second_favorite_category: profile.secondFavoriteCategory,
        preferred_channel: profile.preferredChannel,
        discount_affinity: profile.discountAffinity,
        dominant_price_band: profile.dominantPriceBand,
        category_diversity_score: profile.categoryDiversityScore,
        persona_name: profile.personaName,
        persona_description: profile.personaDescription,
        confidence_score: profile.personaConfidence,
      }));

    customerDetailsByOpportunity.set(opportunity.id, audience);
  }

  const distribution = buildDistribution(opportunities, customerDetailsByOpportunity, totalRevenuePotential).map((row) => ({
    ...row,
    customer_count: counts.get(row.opportunity_id) ?? row.customer_count,
  }));

  return {
    generatedAt: new Date().toISOString(),
    companyId: company.id,
    totalCustomers: profiles.length,
    totalOpportunities: distribution.length,
    totalRevenuePotential,
    topOpportunities: distribution,
    opportunityDistribution: distribution,
    validation: {
      everyOpportunityHasAudience: distribution.every((row) => row.customer_count > 0),
      everyOpportunityHasSummary: distribution.every((row) => row.ai_summary.trim().length > 0),
      confidenceScoresPopulated: distribution.every((row) => row.confidence_score > 0),
      opportunityCountReasonable: distribution.length >= 3 && distribution.length <= 6,
    },
  };
}

export async function getOpportunityCustomers(
  supabase: SupabaseClient,
  opportunityId: string,
): Promise<{ opportunity: OpportunityDistributionRow | null; customers: OpportunityCustomerDetail[] }> {
  const { data: opportunityRow, error: opportunityError } = await supabase
    .from('opportunities')
    .select('id, company_id, opportunity_key, opportunity_type, title, description, audience_size, potential_revenue, confidence_score, priority_score, supporting_customer_segment, recommended_action, audience_definition, trigger_reason, ai_summary, predicted_conversion_rate, alternative_strategies, opportunity_personas, status')
    .eq('id', opportunityId)
    .maybeSingle();

  if (opportunityError) {
    throw new Error(`Failed to load opportunity ${opportunityId}: ${opportunityError.message}`);
  }

  if (!opportunityRow) {
    return { opportunity: null, customers: [] };
  }

  const company = await ensureCompanyRow(supabase, (opportunityRow as any).company_id);
  const dashboard = await getOpportunityDashboard(supabase, company.id);
  const opportunity = dashboard.opportunityDistribution.find((row) => row.opportunity_id === opportunityRow.id) ?? null;

  const { data: audienceData, error } = await supabase
    .from('opportunity_customers')
    .select('customer_id')
    .eq('opportunity_id', opportunityId);

  if (error) {
    throw new Error(`Failed to load opportunity audience: ${error.message}`);
  }

  const customerIds = (audienceData ?? []).map((row: any) => row.customer_id);
  const customers = dashboard.opportunityDistribution.length > 0
    ? await (async () => {
        const [customersResult, metricsResult, attributesResult, personasResult] = await Promise.all([
          supabase.from('customers').select('id, first_name, last_name').in('id', customerIds),
          supabase.from('customer_metrics').select('customer_id, total_spent, total_orders, avg_order_value, last_order_date, days_since_last_order, engagement_score').in('customer_id', customerIds),
          supabase.from('customer_attributes').select('customer_id, favorite_category, second_favorite_category, preferred_channel, discount_affinity, dominant_price_band, category_diversity_score').in('customer_id', customerIds),
          supabase.from('personas').select('customer_id, persona_name, persona_description, confidence_score').in('customer_id', customerIds),
        ]);

        if (customersResult.error) throw new Error(`Failed to load audience customers: ${customersResult.error.message}`);
        if (metricsResult.error) throw new Error(`Failed to load audience metrics: ${metricsResult.error.message}`);
        if (attributesResult.error) throw new Error(`Failed to load audience attributes: ${attributesResult.error.message}`);
        if (personasResult.error) throw new Error(`Failed to load audience personas: ${personasResult.error.message}`);

        const customerById = new Map((customersResult.data ?? []).map((row: any) => [row.id, row]));
        const metricsById = new Map((metricsResult.data ?? []).map((row: any) => [row.customer_id, row]));
        const attributesById = new Map((attributesResult.data ?? []).map((row: any) => [row.customer_id, row]));
        const personasById = new Map((personasResult.data ?? []).map((row: any) => [row.customer_id, row]));

        return customerIds.map((customerId) => {
          const customer = customerById.get(customerId);
          const metrics = metricsById.get(customerId);
          const attributes = attributesById.get(customerId);
          const persona = personasById.get(customerId);

          return {
            customer_id: customerId,
            customer_name: customer ? buildCustomerName(customer) : '',
            total_spent: roundToTwo(toNumber(metrics?.total_spent)),
            total_orders: toNumber(metrics?.total_orders),
            avg_order_value: roundToTwo(toNumber(metrics?.avg_order_value)),
            last_order_date: metrics?.last_order_date ?? null,
            days_since_last_order: metrics?.days_since_last_order === null || metrics?.days_since_last_order === undefined
              ? null
              : Math.trunc(toNumber(metrics.days_since_last_order)),
            favorite_category: attributes?.favorite_category ?? null,
            second_favorite_category: attributes?.second_favorite_category ?? null,
            preferred_channel: attributes?.preferred_channel ?? null,
            discount_affinity: attributes?.discount_affinity ?? null,
            dominant_price_band: attributes?.dominant_price_band ?? null,
            category_diversity_score: attributes?.category_diversity_score === null || attributes?.category_diversity_score === undefined
              ? null
              : roundToTwo(toNumber(attributes.category_diversity_score)),
            persona_name: persona?.persona_name ?? null,
            persona_description: persona?.persona_description ?? null,
            confidence_score: persona?.confidence_score === null || persona?.confidence_score === undefined
              ? null
              : normalizeConfidence(persona.confidence_score),
          } satisfies OpportunityCustomerDetail;
        });
      })()
    : [];

  return { opportunity, customers };
}

/**
 * Refine an existing opportunity based on a marketer's modifier instruction
 */
export async function refineOpportunity(
  supabase: SupabaseClient,
  opportunityId: string,
  modifier: string,
  options: { model?: string } = {},
): Promise<OpportunityDistributionRow> {
  const { data: row, error: fetchError } = await supabase
    .from('opportunities')
    .select('id, company_id, opportunity_key, opportunity_type, title, description, audience_size, potential_revenue, confidence_score, priority_score, supporting_customer_segment, recommended_action, audience_definition, trigger_reason, ai_summary, predicted_conversion_rate, alternative_strategies, opportunity_personas, status')
    .eq('id', opportunityId)
    .maybeSingle();

  if (fetchError) throw new Error(`Failed to load opportunity: ${fetchError.message}`);
  if (!row) throw new Error(`Opportunity ${opportunityId} not found`);

  const model = options.model ?? openRouterConfig.defaultModel;
  const client = new OpenAI({
    apiKey: openRouterConfig.apiKey,
    baseURL: openRouterConfig.baseUrl,
    defaultHeaders: {
      'HTTP-Referer': openRouterConfig.httpReferer,
      'X-Title': openRouterConfig.appName,
    },
  });

  const currentRevenue = toNumber(row.potential_revenue);
  const prompt = [
    'You are a marketing co-pilot for a retail CRM. A marketer wants to modify an existing opportunity.',
    '',
    'Current Opportunity:',
    `- Title: ${row.title}`,
    `- Type: ${row.opportunity_type}`,
    `- Description: ${row.description}`,
    `- Audience Size: ${row.audience_size} customers`,
    `- Potential Revenue: ${formatCurrency(currentRevenue)}`,
    `- Recommended Action: ${row.recommended_action}`,
    `- AI Summary: ${row.ai_summary}`,
    `- Predicted Conversion Rate: ${row.predicted_conversion_rate ?? 'Unknown'}%`,
    '',
    `Marketer's Request: "${modifier}"`,
    '',
    'Evaluate the requested change and return a JSON object with exactly these keys:',
    '{',
    '  "ai_summary": "Updated 2-3 sentence summary reflecting the modification",',
    '  "predicted_conversion_rate": number (updated realistic conversion %, e.g. 12.5),',
    '  "recommended_action": "Updated recommended action if channel/approach changed",',
    '  "alternative_strategies": [',
    '    {"title": "string", "conversion_rate": number, "note": "string"},',
    '    {"title": "string", "conversion_rate": number, "note": "string"}',
    '  ],',
    '  "opportunity_personas": [{"name": "string", "description": "string"}, ...up to 3],',
    `  "potential_revenue": number (updated revenue estimate; current is ${Math.round(currentRevenue)}),`,
    `  "audience_size": number (updated if modifier narrows or broadens audience; current is ${row.audience_size})`,
    '}',
    'Return JSON only. No markdown.',
  ].join('\n');

  const response = await client.chat.completions.create({
    model,
    temperature: 0.3,
    max_tokens: 700,
    messages: [
      { role: 'system', content: 'You output only valid JSON and never include markdown.' },
      { role: 'user', content: prompt },
    ],
  });

  const raw = response.choices[0]?.message?.content ?? '';
  const jsonStr = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
  let aiResponse: Record<string, unknown>;
  try {
    aiResponse = JSON.parse(jsonStr);
  } catch {
    throw new Error('Refine model returned invalid JSON');
  }

  const updatedRevenue = typeof aiResponse.potential_revenue === 'number' ? aiResponse.potential_revenue : currentRevenue;
  const updatedAudienceSize = typeof aiResponse.audience_size === 'number' ? aiResponse.audience_size : row.audience_size;

  const { data: updated, error: updateError } = await supabase
    .from('opportunities')
    .update({
      ai_summary: typeof aiResponse.ai_summary === 'string' ? aiResponse.ai_summary : row.ai_summary,
      predicted_conversion_rate: typeof aiResponse.predicted_conversion_rate === 'number' ? aiResponse.predicted_conversion_rate : row.predicted_conversion_rate,
      recommended_action: typeof aiResponse.recommended_action === 'string' ? aiResponse.recommended_action : row.recommended_action,
      alternative_strategies: Array.isArray(aiResponse.alternative_strategies) ? aiResponse.alternative_strategies : row.alternative_strategies,
      opportunity_personas: Array.isArray(aiResponse.opportunity_personas) ? aiResponse.opportunity_personas : row.opportunity_personas,
      potential_revenue: updatedRevenue,
      audience_size: updatedAudienceSize,
      updated_at: new Date().toISOString(),
    })
    .eq('id', opportunityId)
    .select('id, company_id, opportunity_key, opportunity_type, title, description, audience_size, potential_revenue, confidence_score, priority_score, supporting_customer_segment, recommended_action, audience_definition, trigger_reason, ai_summary, predicted_conversion_rate, alternative_strategies, opportunity_personas, status')
    .single();

  if (updateError) throw new Error(`Failed to update opportunity: ${updateError.message}`);

  return {
    opportunity_id: updated.id,
    opportunity_key: updated.opportunity_key,
    opportunity_type: updated.opportunity_type,
    title: updated.title,
    description: updated.description,
    audience_size: updated.audience_size,
    potential_revenue: roundToTwo(toNumber(updated.potential_revenue)),
    confidence_score: roundToTwo(toNumber(updated.confidence_score)),
    priority_score: roundToTwo(toNumber(updated.priority_score)),
    supporting_customer_segment: updated.supporting_customer_segment,
    recommended_action: updated.recommended_action,
    audience_definition: updated.audience_definition,
    trigger_reason: updated.trigger_reason,
    ai_summary: updated.ai_summary,
    predicted_conversion_rate: updated.predicted_conversion_rate ?? null,
    alternative_strategies: (updated.alternative_strategies ?? null) as Array<{ title: string; conversion_rate: number; note: string }> | null,
    opportunity_personas: (updated.opportunity_personas ?? null) as Array<{ name: string; description: string }> | null,
    status: updated.status,
    customer_count: row.audience_size,
    average_spend: 0,
    average_orders: 0,
    revenue_share: 0,
  };
}

/**
 * Create a custom opportunity from user's marketing goal using AI
 */
export async function createOpportunityFromGoal(
  supabase: SupabaseClient,
  goal: string,
  options: { companyId?: string; model?: string } = {},
): Promise<OpportunityDistributionRow> {
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

  logger.info({ goal }, '[createOpportunityFromGoal] Analyzing goal');

  // Fetch customer data to understand the business context
  const [customers, metricsByCustomer, attributesByCustomer, personasByCustomer, orders, orderItems, productsById] = await Promise.all([
    fetchCustomers(supabase),
    fetchMetrics(supabase),
    fetchAttributes(supabase),
    fetchPersonas(supabase),
    fetchOrders(supabase),
    fetchOrderItems(supabase),
    fetchProducts(supabase),
  ]);

  const profiles = buildProfiles(
    customers,
    metricsByCustomer,
    attributesByCustomer,
    personasByCustomer,
    orders,
    orderItems,
    productsById,
  );

  // Get business context summary
  const totalCustomers = profiles.length;
  const totalRevenue = profiles.reduce((sum, p) => sum + p.totalSpent, 0);
  const avgOrderValue = totalRevenue / profiles.reduce((sum, p) => sum + p.totalOrders, 0);
  const topCategories = Array.from(
    profiles.reduce((map, p) => {
      p.purchasedCategories.forEach(cat => map.set(cat, (map.get(cat) || 0) + 1));
      return map;
    }, new Map<string, number>())
  ).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([cat]) => cat);

  const personaNames = Array.from(new Set(profiles.map(p => p.personaName).filter(Boolean)));

  // Use AI to interpret the goal and create opportunity
  const prompt = `You are an AI marketing analyst helping a ${company.industry || 'retail'} company called "${company.company_name}".

Business Context:
- Total Customers: ${totalCustomers}
- Total Revenue: ₹${Math.round(totalRevenue).toLocaleString('en-IN')}
- Average Order Value: ₹${Math.round(avgOrderValue).toLocaleString('en-IN')}
- Top Product Categories: ${topCategories.join(', ')}
- Customer Personas: ${personaNames.join(', ')}

The marketer wants to achieve this goal:
"${goal}"

Create a specific, actionable marketing opportunity that helps achieve this goal. Return a JSON object with this exact structure:

{
  "opportunity_type": "string (e.g., Custom Goal, Revenue Growth, Customer Engagement)",
  "title": "string (concise, under 50 chars, specific to the goal)",
  "description": "string (2-3 sentences explaining the opportunity)",
  "audience_criteria": {
    "min_total_spent": number or null,
    "max_days_since_last_order": number or null,
    "preferred_categories": string[] or null,
    "persona_names": string[] or null
  },
  "estimated_audience_pct": number (0-100, realistic percentage of customers who match),
  "revenue_multiplier": number (1.1-3.0, expected revenue increase per customer),
  "confidence_score": number (60-95, how confident you are this will work),
  "trigger_reason": "string (why this opportunity exists based on the goal)",
  "recommended_action": "string (specific next step)",
  "ai_summary": "string (2-3 sentences on why this is a good opportunity)",
  "predicted_conversion_rate": number (realistic conversion %, e.g. 14.5),
  "alternative_strategies": [
    {"title": "string", "conversion_rate": number, "note": "string explaining the alternative"},
    {"title": "string", "conversion_rate": number, "note": "string"}
  ],
  "opportunity_personas": [
    {"name": "string", "description": "string"},
    {"name": "string", "description": "string"}
  ]
}

Be realistic - don't promise impossible results. Base estimates on the business context provided.`;

  const response = await client.chat.completions.create({
    model,
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.7,
    max_tokens: 2000,
  });

  const content = response.choices[0]?.message?.content || '{}';
  const jsonString = content.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
  const aiResponse = JSON.parse(jsonString);
  logger.info({ aiResponse }, '[createOpportunityFromGoal] AI response received');

  // Apply audience criteria to find matching customers
  const matchingProfiles = profiles.filter((profile) => {
    const criteria = aiResponse.audience_criteria || {};

    if (criteria.min_total_spent && profile.totalSpent < criteria.min_total_spent) return false;
    if (criteria.max_days_since_last_order && profile.daysSinceLastOrder && profile.daysSinceLastOrder > criteria.max_days_since_last_order) return false;

    if (criteria.preferred_categories && criteria.preferred_categories.length > 0) {
      const hasCategory = criteria.preferred_categories.some((cat: string) => {
        const needle = cat.toLowerCase();
        return (
          profile.favoriteCategory?.toLowerCase().includes(needle) ||
          profile.secondFavoriteCategory?.toLowerCase().includes(needle) ||
          needle.includes(profile.favoriteCategory?.toLowerCase() || '____') ||
          needle.includes(profile.secondFavoriteCategory?.toLowerCase() || '____')
        );
      });
      if (!hasCategory) return false;
    }

    if (criteria.persona_names && criteria.persona_names.length > 0) {
      if (!profile.personaName || !criteria.persona_names.includes(profile.personaName)) return false;
    }

    return true;
  });

  // Fallback: if strict criteria matched nobody, use AI's estimated audience percentage
  const effectiveProfiles = matchingProfiles.length > 0
    ? matchingProfiles
    : profiles.slice(0, Math.max(1, Math.round(profiles.length * ((aiResponse.estimated_audience_pct || 20) / 100))));

  const audienceSize = effectiveProfiles.length;
  const potentialRevenue = effectiveProfiles.reduce((sum, p) => sum + p.avgOrderValue, 0) * (aiResponse.revenue_multiplier || 1.5);

  // Create opportunity record
  const opportunityKey = `custom_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  const opportunityRecord: OpportunityRecord = {
    company_id: company.id,
    opportunity_key: opportunityKey,
    opportunity_type: aiResponse.opportunity_type || 'Custom Goal',
    title: aiResponse.title || goal.substring(0, 50),
    description: aiResponse.description || `Opportunity created from custom goal: ${goal}`,
    audience_size: audienceSize,
    potential_revenue: Math.round(potentialRevenue),
    confidence_score: aiResponse.confidence_score || 75,
    priority_score: Math.round((aiResponse.confidence_score || 75) * 0.8),
    supporting_customer_segment: effectiveProfiles.length > 0 ? effectiveProfiles[0].personaName || 'All Customers' : 'All Customers',
    recommended_action: aiResponse.recommended_action || 'Review opportunity and create campaign',
    audience_definition: aiResponse.audience_criteria || {},
    trigger_reason: aiResponse.trigger_reason || `Generated from marketer goal: "${goal}"`,
    ai_summary: aiResponse.ai_summary || `AI-generated opportunity to help achieve: ${goal}`,
    predicted_conversion_rate: typeof aiResponse.predicted_conversion_rate === 'number' ? aiResponse.predicted_conversion_rate : null,
    alternative_strategies: Array.isArray(aiResponse.alternative_strategies) ? aiResponse.alternative_strategies : null,
    opportunity_personas: Array.isArray(aiResponse.opportunity_personas) ? aiResponse.opportunity_personas : null,
    status: 'Detected',
  };

  // Persist to database
  const { data: insertedOpportunity, error } = await supabase
    .from('opportunities')
    .insert(opportunityRecord)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create opportunity: ${error.message}`);
  }

  // Link customers to opportunity
  if (effectiveProfiles.length > 0) {
    const opportunityCustomers = effectiveProfiles.map(p => ({
      opportunity_id: insertedOpportunity.id,
      customer_id: p.customerId,
    }));

    const { error: linkError } = await supabase
      .from('opportunity_customers')
      .insert(opportunityCustomers);

    if (linkError) {
      logger.error({ err: linkError }, '[createOpportunityFromGoal] Failed to link customers');
    }
  }

  logger.info({ opportunityId: insertedOpportunity.id, audienceSize }, '[createOpportunityFromGoal] Created opportunity');

  // Return in dashboard format
  const avgSpend = effectiveProfiles.length > 0
    ? effectiveProfiles.reduce((sum, p) => sum + p.totalSpent, 0) / effectiveProfiles.length
    : 0;
  const avgOrders = effectiveProfiles.length > 0
    ? effectiveProfiles.reduce((sum, p) => sum + p.totalOrders, 0) / effectiveProfiles.length
    : 0;

  return {
    opportunity_id: insertedOpportunity.id,
    opportunity_key: opportunityRecord.opportunity_key,
    opportunity_type: opportunityRecord.opportunity_type,
    title: opportunityRecord.title,
    description: opportunityRecord.description,
    audience_size: audienceSize,
    potential_revenue: opportunityRecord.potential_revenue,
    confidence_score: opportunityRecord.confidence_score,
    priority_score: opportunityRecord.priority_score,
    supporting_customer_segment: opportunityRecord.supporting_customer_segment,
    recommended_action: opportunityRecord.recommended_action,
    audience_definition: opportunityRecord.audience_definition,
    trigger_reason: opportunityRecord.trigger_reason,
    ai_summary: opportunityRecord.ai_summary,
    predicted_conversion_rate: opportunityRecord.predicted_conversion_rate ?? null,
    alternative_strategies: (opportunityRecord.alternative_strategies ?? null) as Array<{ title: string; conversion_rate: number; note: string }> | null,
    opportunity_personas: (opportunityRecord.opportunity_personas ?? null) as Array<{ name: string; description: string }> | null,
    status: opportunityRecord.status,
    customer_count: audienceSize,
    average_spend: Math.round(avgSpend),
    average_orders: Math.round(avgOrders),
    revenue_share: totalRevenue > 0 ? (potentialRevenue / totalRevenue) * 100 : 0,
  };
}

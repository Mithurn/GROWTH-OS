import { logger as rootLogger } from '../lib/logger';
import { prisma } from '../lib/prisma';

export interface CustomerAttributesLogger {
  info: (message: string, ...args: unknown[]) => void;
  warn: (message: string, ...args: unknown[]) => void;
  error: (message: string, ...args: unknown[]) => void;
}

export interface CustomerAttributesRecord {
  customer_id: string;
  company_id?: string;
  favorite_category: string | null;
  second_favorite_category: string | null;
  preferred_channel: string | null;
  discount_affinity: 'High' | 'Medium' | 'Low';
  avg_days_between_orders: number | null;
  dominant_price_band: string | null;
  category_diversity_score: number;
  updated_at?: string;
}

export interface CustomerAttributesReport {
  generatedAt: string;
  totalCustomers: number;
  totalOrders: number;
  totalAttributesRecords: number;
  topCategories: AttributeCategorySummary[];
  highestDiscountAffinityCustomers: AttributeSummary[];
  strongestCategoryLoyaltyCustomers: AttributeSummary[];
  mostDiverseCustomers: AttributeSummary[];
  sampleValidations: AttributeValidationResult[];
}

export interface AttributeValidationResult {
  customerId: string;
  customerName: string;
  rawFavoriteCategory: string | null;
  rawSecondFavoriteCategory: string | null;
  rawPreferredChannel: string | null;
  rawDiscountAffinity: 'High' | 'Medium' | 'Low';
  rawAvgDaysBetweenOrders: number | null;
  rawDominantPriceBand: string | null;
  rawCategoryDiversityScore: number;
  storedFavoriteCategory: string | null;
  storedSecondFavoriteCategory: string | null;
  storedPreferredChannel: string | null;
  storedDiscountAffinity: 'High' | 'Medium' | 'Low';
  storedAvgDaysBetweenOrders: number | null;
  storedDominantPriceBand: string | null;
  storedCategoryDiversityScore: number;
  matches: boolean;
}

export interface AttributeCategorySummary {
  category: string;
  customerCount: number;
}

export interface AttributeSummary {
  customer_id: string;
  total_orders: number;
  favorite_category: string | null;
  second_favorite_category: string | null;
  preferred_channel: string | null;
  discount_affinity: 'High' | 'Medium' | 'Low';
  avg_days_between_orders: number | null;
  dominant_price_band: string | null;
  category_diversity_score: number;
}

interface CustomerRow {
  id: string;
  first_name: string;
  last_name: string | null;
}

interface OrderRow {
  id: string;
  customer_id: string;
  order_date: string;
  channel: string | null;
}

interface OrderItemRow {
  order_id: string;
  product_id: string;
  quantity: number | string;
  unit_price: number | string;
}

interface ProductRow {
  id: string;
  category: string | null;
  price: number | string;
}

interface StoredAttributeRow {
  customer_id: string;
  favorite_category: string | null;
  second_favorite_category: string | null;
  preferred_channel: string | null;
  discount_affinity: 'High' | 'Medium' | 'Low';
  avg_days_between_orders: number | string | null;
  dominant_price_band: string | null;
  category_diversity_score: number | string;
}

interface CustomerContext {
  orders: OrderRow[];
  categorySpend: Map<string, number>;
  channelMeta: Map<string, { count: number; lastSeen: number }>;
  priceBandSpend: Map<string, number>;
  totalItemSpend: number;
}

interface GenerateCustomerAttributesOptions {
  batchSize?: number;
  logger?: CustomerAttributesLogger;
  companyId: string;
}

const DEFAULT_BATCH_SIZE = 100;
const DAY_MS = 24 * 60 * 60 * 1000;

const defaultLogger: CustomerAttributesLogger = {
  info:  (msg, ...args) => rootLogger.info(args[0] ?? {}, msg),
  warn:  (msg, ...args) => rootLogger.warn(args[0] ?? {}, msg),
  error: (msg, ...args) => rootLogger.error(args[0] ?? {}, msg),
};

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

function toDateKey(value: string | Date | null | undefined): string | null {
  if (value == null) return null;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString().slice(0, 10);
  }

  const trimmed = value.trim();
  if (!trimmed) return null;

  if (trimmed.length >= 10) {
    return trimmed.slice(0, 10);
  }

  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
}

function dateKeyToUtcTimestamp(dateKey: string): number | null {
  const parsed = new Date(`${dateKey}T00:00:00Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed.getTime();
}

function getPriceBand(price: number): string {
  if (price < 1500) return 'Budget';
  if (price < 3000) return 'Mid';
  if (price < 5000) return 'Premium';
  return 'Luxury';
}

function buildCustomerName(customer: CustomerRow): string {
  const lastName = customer.last_name?.trim();
  return lastName ? `${customer.first_name} ${lastName}` : customer.first_name;
}

function computeAverageDaysBetweenOrders(orders: OrderRow[]): number | null {
  if (orders.length < 2) {
    return null;
  }

  const timestamps = orders
    .map((order) => {
      const key = toDateKey(order.order_date);
      return key ? dateKeyToUtcTimestamp(key) : null;
    })
    .filter((value): value is number => value !== null)
    .sort((a, b) => a - b);

  if (timestamps.length < 2) {
    return null;
  }

  const gaps: number[] = [];
  for (let index = 1; index < timestamps.length; index += 1) {
    gaps.push(Math.max(0, (timestamps[index] - timestamps[index - 1]) / DAY_MS));
  }

  const total = gaps.reduce((sum, gap) => sum + gap, 0);
  return roundToTwo(total / gaps.length);
}

function computeShannonDiversity(spendByCategory: Map<string, number>): number {
  const values = [...spendByCategory.values()].filter((value) => value > 0);
  if (values.length < 2) {
    return 0;
  }

  const total = values.reduce((sum, value) => sum + value, 0);
  if (total <= 0) {
    return 0;
  }

  const entropy = values.reduce((sum, value) => {
    const p = value / total;
    return sum - (p * Math.log(p));
  }, 0);

  const normalized = entropy / Math.log(values.length);
  return roundToTwo(Math.max(0, Math.min(100, normalized * 100)));
}

function determineDiscountAffinity(totalItemSpend: number, budgetSpend: number): 'High' | 'Medium' | 'Low' {
  if (totalItemSpend <= 0) {
    return 'Low';
  }

  const budgetShare = budgetSpend / totalItemSpend;

  if (budgetShare >= 0.6) return 'High';
  if (budgetShare >= 0.3) return 'Medium';

  return 'Low';
}

function determinePreferredChannel(channelMeta: Map<string, { count: number; lastSeen: number }>): string | null {
  if (channelMeta.size === 0) {
    return null;
  }

  return [...channelMeta.entries()]
    .sort((a, b) => {
      const countDelta = b[1].count - a[1].count;
      if (countDelta !== 0) return countDelta;
      const lastSeenDelta = b[1].lastSeen - a[1].lastSeen;
      if (lastSeenDelta !== 0) return lastSeenDelta;
      return a[0].localeCompare(b[0]);
    })[0][0];
}

function determineDominantPriceBand(priceBandSpend: Map<string, number>): string | null {
  if (priceBandSpend.size === 0) {
    return null;
  }

  return [...priceBandSpend.entries()]
    .sort((a, b) => {
      const spendDelta = b[1] - a[1];
      if (spendDelta !== 0) return spendDelta;
      return a[0].localeCompare(b[0]);
    })[0][0];
}

function buildCustomerContext(
  customers: CustomerRow[],
  orders: OrderRow[],
  orderItems: OrderItemRow[],
  products: ProductRow[],
): Map<string, CustomerContext> {
  const contextByCustomerId = new Map<string, CustomerContext>();
  const orderById = new Map<string, OrderRow>();
  const productById = new Map<string, ProductRow>();

  for (const customer of customers) {
    contextByCustomerId.set(customer.id, {
      orders: [],
      categorySpend: new Map(),
      channelMeta: new Map(),
      priceBandSpend: new Map(),
      totalItemSpend: 0,
    });
  }

  for (const order of orders) {
    orderById.set(order.id, order);
    const context = contextByCustomerId.get(order.customer_id);
    if (!context) continue;

    context.orders.push(order);
    const channel = order.channel?.trim() || 'Unknown';
    const seenAt = dateKeyToUtcTimestamp(toDateKey(order.order_date) ?? '');
    const channelStats = context.channelMeta.get(channel) ?? { count: 0, lastSeen: 0 };
    channelStats.count += 1;
    if (seenAt !== null) {
      channelStats.lastSeen = Math.max(channelStats.lastSeen, seenAt);
    }
    context.channelMeta.set(channel, channelStats);
  }

  for (const product of products) {
    productById.set(product.id, product);
  }

  for (const item of orderItems) {
    const order = orderById.get(item.order_id);
    if (!order) continue;

    const context = contextByCustomerId.get(order.customer_id);
    if (!context) continue;

    const product = productById.get(item.product_id);
    if (!product) continue;

    const spend = toNumber(item.unit_price) * Math.max(1, Math.trunc(toNumber(item.quantity)));
    const category = product.category?.trim() || null;
    const priceBand = getPriceBand(toNumber(product.price));

    context.totalItemSpend += spend;

    if (category) {
      context.categorySpend.set(category, (context.categorySpend.get(category) ?? 0) + spend);
    }

    context.priceBandSpend.set(priceBand, (context.priceBandSpend.get(priceBand) ?? 0) + spend);
  }

  return contextByCustomerId;
}

function buildAttributes(
  customer: CustomerRow,
  context: CustomerContext,
): CustomerAttributesRecord & {
  category_loyalty_score: number;
  budget_share: number;
} {
  const categorySpendEntries = [...context.categorySpend.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const favoriteCategory = categorySpendEntries[0]?.[0] ?? null;
  const secondFavoriteCategory = categorySpendEntries[1]?.[0] ?? null;
  const totalCategorySpend = categorySpendEntries.reduce((sum, [, spend]) => sum + spend, 0);
  const topCategoryShare = totalCategorySpend > 0 && categorySpendEntries.length > 0
    ? roundToTwo((categorySpendEntries[0][1] / totalCategorySpend) * 100)
    : 0;
  const budgetSpend = context.priceBandSpend.get('Budget') ?? 0;
  const budgetShare = context.totalItemSpend > 0 ? budgetSpend / context.totalItemSpend : 0;
  const preferredChannel = determinePreferredChannel(context.channelMeta);
  const dominantPriceBand = determineDominantPriceBand(context.priceBandSpend);
  const avgDaysBetweenOrders = computeAverageDaysBetweenOrders(context.orders);
  const categoryDiversityScore = computeShannonDiversity(context.categorySpend);
  const discountAffinity = determineDiscountAffinity(context.totalItemSpend, budgetSpend);

  return {
    customer_id: customer.id,
    favorite_category: favoriteCategory,
    second_favorite_category: secondFavoriteCategory,
    preferred_channel: preferredChannel,
    discount_affinity: discountAffinity,
    avg_days_between_orders: avgDaysBetweenOrders,
    dominant_price_band: dominantPriceBand,
    category_diversity_score: categoryDiversityScore,
    updated_at: new Date().toISOString(),
    category_loyalty_score: topCategoryShare,
    budget_share: roundToTwo(budgetShare * 100),
  };
}

async function upsertInBatches(
  attributes: CustomerAttributesRecord[],
  batchSize: number,
  logger: CustomerAttributesLogger,
): Promise<void> {
  for (let index = 0; index < attributes.length; index += batchSize) {
    const batch = attributes.slice(index, index + batchSize);
    const batchNumber = Math.floor(index / batchSize) + 1;
    const totalBatches = Math.ceil(attributes.length / batchSize);

    logger.info(
      `[customer_attributes] Upserting batch ${batchNumber}/${totalBatches} (${batch.length} records)`,
    );

    await prisma.$transaction(batch.map((row) => prisma.customerAttributes.upsert({
      where: { customerId: row.customer_id },
      create: {
        companyId: row.company_id!,
        customerId: row.customer_id,
        favoriteCategory: row.favorite_category,
        secondFavoriteCategory: row.second_favorite_category,
        preferredChannel: row.preferred_channel,
        discountAffinity: row.discount_affinity,
        avgDaysBetweenOrders: row.avg_days_between_orders,
        dominantPriceBand: row.dominant_price_band,
        categoryDiversityScore: row.category_diversity_score,
      },
      update: {
        favoriteCategory: row.favorite_category,
        secondFavoriteCategory: row.second_favorite_category,
        preferredChannel: row.preferred_channel,
        discountAffinity: row.discount_affinity,
        avgDaysBetweenOrders: row.avg_days_between_orders,
        dominantPriceBand: row.dominant_price_band,
        categoryDiversityScore: row.category_diversity_score,
      },
    })));
  }
}

async function fetchAttributesCount(companyId: string): Promise<number> {
  return prisma.customerAttributes.count({ where: { companyId } });
}

async function fetchStoredAttributesForCustomer(
  customerId: string,
): Promise<StoredAttributeRow | null> {
  const row = await prisma.customerAttributes.findUnique({ where: { customerId } });
  if (!row) return null;
  return {
    customer_id: row.customerId,
    favorite_category: row.favoriteCategory,
    second_favorite_category: row.secondFavoriteCategory,
    preferred_channel: row.preferredChannel,
    discount_affinity: row.discountAffinity as 'High' | 'Medium' | 'Low',
    avg_days_between_orders: row.avgDaysBetweenOrders === null ? null : Number(row.avgDaysBetweenOrders),
    dominant_price_band: row.dominantPriceBand,
    category_diversity_score: Number(row.categoryDiversityScore),
  };
}

function compareAttributesToRawData(
  customerId: string,
  rawContext: CustomerContext,
  storedAttributes: StoredAttributeRow | null,
  customer: CustomerRow,
): AttributeValidationResult {
  const computed = buildAttributes(customer, rawContext);
  const rawAverageDaysBetweenOrders = computed.avg_days_between_orders;

  return {
    customerId,
    customerName: buildCustomerName(customer),
    rawFavoriteCategory: computed.favorite_category,
    rawSecondFavoriteCategory: computed.second_favorite_category,
    rawPreferredChannel: computed.preferred_channel,
    rawDiscountAffinity: computed.discount_affinity,
    rawAvgDaysBetweenOrders: rawAverageDaysBetweenOrders,
    rawDominantPriceBand: computed.dominant_price_band,
    rawCategoryDiversityScore: computed.category_diversity_score,
    storedFavoriteCategory: storedAttributes?.favorite_category ?? null,
    storedSecondFavoriteCategory: storedAttributes?.second_favorite_category ?? null,
    storedPreferredChannel: storedAttributes?.preferred_channel ?? null,
    storedDiscountAffinity: storedAttributes?.discount_affinity ?? 'Low',
    storedAvgDaysBetweenOrders: storedAttributes?.avg_days_between_orders === null || storedAttributes?.avg_days_between_orders === undefined
      ? null
      : roundToTwo(toNumber(storedAttributes.avg_days_between_orders)),
    storedDominantPriceBand: storedAttributes?.dominant_price_band ?? null,
    storedCategoryDiversityScore: roundToTwo(toNumber(storedAttributes?.category_diversity_score)),
    matches:
      storedAttributes !== null &&
      computed.favorite_category === storedAttributes.favorite_category &&
      computed.second_favorite_category === storedAttributes.second_favorite_category &&
      computed.preferred_channel === storedAttributes.preferred_channel &&
      computed.discount_affinity === storedAttributes.discount_affinity &&
      computed.dominant_price_band === storedAttributes.dominant_price_band &&
      roundToTwo(computed.category_diversity_score) === roundToTwo(toNumber(storedAttributes.category_diversity_score)) &&
      (computed.avg_days_between_orders === null
        ? storedAttributes.avg_days_between_orders === null || storedAttributes.avg_days_between_orders === undefined
        : roundToTwo(computed.avg_days_between_orders) === roundToTwo(toNumber(storedAttributes.avg_days_between_orders))),
  };
}

function pickValidationCustomerIds(attributes: CustomerAttributesRecord[]): string[] {
  const selected: string[] = [];

  const addCandidate = (candidate?: CustomerAttributesRecord) => {
    if (!candidate) return;
    if (!selected.includes(candidate.customer_id)) {
      selected.push(candidate.customer_id);
    }
  };

  addCandidate([...attributes].sort((a, b) => b.category_diversity_score - a.category_diversity_score)[0]);
  addCandidate(attributes.find((attribute) => attribute.favorite_category !== null));

  const zeroOrderCustomer = attributes.find((attribute) =>
    !attribute.favorite_category &&
    !attribute.second_favorite_category &&
    !attribute.preferred_channel &&
    attribute.avg_days_between_orders === null,
  );

  if (zeroOrderCustomer) {
    addCandidate(zeroOrderCustomer);
  } else {
    addCandidate(attributes[attributes.length - 1]);
  }

  return selected.slice(0, 3);
}

function summarizeTopCategories(attributes: CustomerAttributesRecord[]): AttributeCategorySummary[] {
  const categoryCounts = new Map<string, number>();

  for (const attribute of attributes) {
    if (!attribute.favorite_category) continue;
    categoryCounts.set(attribute.favorite_category, (categoryCounts.get(attribute.favorite_category) ?? 0) + 1);
  }

  return [...categoryCounts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 10)
    .map(([category, customerCount]) => ({ category, customerCount }));
}

export async function generateCustomerAttributes(
  options: GenerateCustomerAttributesOptions,
): Promise<CustomerAttributesReport> {
  const logger = options.logger ?? defaultLogger;
  const batchSize = options.batchSize ?? DEFAULT_BATCH_SIZE;
  const { companyId } = options;
  const now = new Date();

  logger.info('[customer_attributes] Starting generation pipeline');

  const [customerRows, orderRows, orderItemRows, productRows] = await Promise.all([
    prisma.customer.findMany({
      where: { companyId },
      orderBy: { createdAt: 'asc' },
      select: { id: true, firstName: true, lastName: true },
    }),
    prisma.order.findMany({
      where: { companyId },
      select: { id: true, customerId: true, orderDate: true, channel: true },
    }),
    prisma.orderItem.findMany({
      where: { companyId },
      select: { orderId: true, productId: true, quantity: true, unitPrice: true },
    }),
    prisma.product.findMany({
      where: { companyId },
      select: { id: true, category: true, price: true },
    }),
  ]);
  const customers: CustomerRow[] = customerRows.map((row) => ({
    id: row.id,
    first_name: row.firstName,
    last_name: row.lastName,
  }));
  const orders: OrderRow[] = orderRows.map((row) => ({
    id: row.id,
    customer_id: row.customerId,
    order_date: row.orderDate.toISOString(),
    channel: row.channel,
  }));
  const orderItems: OrderItemRow[] = orderItemRows.map((row) => ({
    order_id: row.orderId,
    product_id: row.productId,
    quantity: row.quantity,
    unit_price: Number(row.unitPrice),
  }));
  const products: ProductRow[] = productRows.map((row) => ({
    id: row.id,
    category: row.category,
    price: Number(row.price),
  }));

  logger.info(
    `[customer_attributes] Loaded ${customers.length} customers, ${orders.length} orders, ${orderItems.length} order items`,
  );

  const contextByCustomerId = buildCustomerContext(customers, orders, orderItems, products);
  const attributesWithStats = customers.map((customer) => {
    const context = contextByCustomerId.get(customer.id) ?? {
      orders: [],
      categorySpend: new Map(),
      channelMeta: new Map(),
      priceBandSpend: new Map(),
      totalItemSpend: 0,
    };

    return {
      ...buildAttributes(customer, context),
    };
  });

  const attributes: CustomerAttributesRecord[] = attributesWithStats.map((row) => ({
    customer_id: row.customer_id,
    company_id: companyId,
    favorite_category: row.favorite_category,
    second_favorite_category: row.second_favorite_category,
    preferred_channel: row.preferred_channel,
    discount_affinity: row.discount_affinity,
    avg_days_between_orders: row.avg_days_between_orders,
    dominant_price_band: row.dominant_price_band,
    category_diversity_score: row.category_diversity_score,
  }));

  logger.info('[customer_attributes] Computed attributes for all customers');

  await upsertInBatches(attributes, batchSize, logger);

  const totalAttributesRecords = await fetchAttributesCount(companyId);
  const topCategories = summarizeTopCategories(attributes);

  const highestDiscountAffinityCustomers = [...attributes]
    .sort((a, b) => {
      const affinityOrder = (value: string) => {
        if (value === 'High') return 3;
        if (value === 'Medium') return 2;
        return 1;
      };

      const affinityDelta = affinityOrder(b.discount_affinity) - affinityOrder(a.discount_affinity);
      if (affinityDelta !== 0) return affinityDelta;
      return b.category_diversity_score - a.category_diversity_score;
    })
    .slice(0, 10)
    .map((row) => ({
      ...row,
      total_orders: contextByCustomerId.get(row.customer_id)?.orders.length ?? 0,
    }));

  const strongestCategoryLoyaltyCustomers = [...attributes]
    .sort((a, b) => {
      const aLoyalty = a.favorite_category ? 1 : 0;
      const bLoyalty = b.favorite_category ? 1 : 0;
      if (aLoyalty !== bLoyalty) return bLoyalty - aLoyalty;
      return a.category_diversity_score - b.category_diversity_score;
    })
    .slice(0, 10)
    .map((row) => ({
      ...row,
      total_orders: contextByCustomerId.get(row.customer_id)?.orders.length ?? 0,
    }));

  const mostDiverseCustomers = [...attributes]
    .sort((a, b) => b.category_diversity_score - a.category_diversity_score || (contextByCustomerId.get(b.customer_id)?.orders.length ?? 0) - (contextByCustomerId.get(a.customer_id)?.orders.length ?? 0))
    .slice(0, 10)
    .map((row) => ({
      ...row,
      total_orders: contextByCustomerId.get(row.customer_id)?.orders.length ?? 0,
    }));

  const validationCustomerIds = pickValidationCustomerIds(attributes);
  const sampleValidations: AttributeValidationResult[] = [];

  for (const customerId of validationCustomerIds) {
    const customer = customers.find((row) => row.id === customerId);
    if (!customer) continue;

    const rawContext = contextByCustomerId.get(customerId);
    if (!rawContext) continue;

    const storedAttributes = await fetchStoredAttributesForCustomer(customerId);
    const validation = compareAttributesToRawData(customerId, rawContext, storedAttributes, customer);
    sampleValidations.push(validation);
  }

  for (const validation of sampleValidations) {
    if (validation.matches) {
      logger.info(
        `[customer_attributes] Validation passed for ${validation.customerName} (${validation.customerId})`,
      );
    } else {
      logger.warn(
        `[customer_attributes] Validation mismatch for ${validation.customerName} (${validation.customerId})`,
        validation,
      );
    }
  }

  logger.info(
    `[customer_attributes] Generation complete. customers=${customers.length}, attributes=${totalAttributesRecords}`,
  );
  logger.info('[customer_attributes] Top categories:', topCategories);
  logger.info('[customer_attributes] Highest discount affinity customers:', highestDiscountAffinityCustomers);
  logger.info('[customer_attributes] Strongest category loyalty customers:', strongestCategoryLoyaltyCustomers);
  logger.info('[customer_attributes] Most diverse customers:', mostDiverseCustomers);

  return {
    generatedAt: now.toISOString(),
    totalCustomers: customers.length,
    totalOrders: orders.length,
    totalAttributesRecords,
    topCategories,
    highestDiscountAffinityCustomers,
    strongestCategoryLoyaltyCustomers,
    mostDiverseCustomers,
    sampleValidations,
  };
}

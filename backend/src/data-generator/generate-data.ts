import { faker } from '@faker-js/faker';
import * as fs from 'fs';
import * as path from 'path';

const CUSTOMER_PERSONAS = {
  DORMANT_VIP: 0.15,        // High-value customers who stopped buying (great for winback campaigns)
  PREMIUM_LOYALIST: 0.20,   // Best customers - frequent, high-value (upsell opportunities)
  DISCOUNT_HUNTER: 0.15,    // Price-sensitive buyers (loyalty challenges)
  CHURN_RISK: 0.12,         // Active but showing decline (retention campaigns)
  CROSS_SELL: 0.18,         // Single category buyers (cross-sell opportunities)
  SEASONAL: 0.10,           // Buy during specific periods (reactivation campaigns)
  REGULAR: 0.10,            // Standard customers (baseline)
};

const TOTAL_CUSTOMERS = Number(process.env.TOTAL_CUSTOMERS ?? 1000);  // Rich demo dataset
const TARGET_LINE_ITEMS = Number(process.env.TOTAL_ORDERS ?? 4500);   // ~4.5 orders per customer avg
const ORDER_HISTORY_MONTHS = Number(process.env.ORDER_HISTORY_MONTHS ?? 18);
const CITIES = 10;
const TODAY = new Date();

// Indian cities for realistic data
const INDIAN_CITIES = [
  { city: 'Mumbai', state: 'Maharashtra' },
  { city: 'Delhi', state: 'Delhi' },
  { city: 'Bangalore', state: 'Karnataka' },
  { city: 'Hyderabad', state: 'Telangana' },
  { city: 'Chennai', state: 'Tamil Nadu' },
  { city: 'Kolkata', state: 'West Bengal' },
  { city: 'Pune', state: 'Maharashtra' },
  { city: 'Ahmedabad', state: 'Gujarat' },
  { city: 'Jaipur', state: 'Rajasthan' },
  { city: 'Lucknow', state: 'Uttar Pradesh' },
];

// Product categories with IDs (matching our 50 products)
const PRODUCT_CATEGORIES = {
  "Women's Kurtas": { skus: ['WK001', 'WK002', 'WK003', 'WK004', 'WK005', 'WK006', 'WK007', 'WK008', 'WK009', 'WK010', 'WK011', 'WK012'], popular: true },
  "Men's Kurtas": { skus: ['MK001', 'MK002', 'MK003', 'MK004', 'MK005', 'MK006', 'MK007', 'MK008'], popular: false },
  'Sarees': { skus: ['SAR001', 'SAR002', 'SAR003', 'SAR004', 'SAR005', 'SAR006'], popular: true },
  'Dupattas': { skus: ['DUP001', 'DUP002', 'DUP003', 'DUP004', 'DUP005'], popular: false },
  'Handbags': { skus: ['BAG001', 'BAG002', 'BAG003', 'BAG004', 'BAG005'], popular: false },
  'Jewelry': { skus: ['JWL001', 'JWL002', 'JWL003', 'JWL004', 'JWL005'], popular: true },
  'Footwear': { skus: ['FTW001', 'FTW002', 'FTW003', 'FTW004'], popular: false },
  'Home Decor': { skus: ['HOM001', 'HOM002', 'HOM003'], popular: false },
  'Scarves': { skus: ['SCF001', 'SCF002'], popular: false },
  'Gift Sets': { skus: ['GFT001', 'GFT002'], popular: false },
};

// Product prices (matching products.ts)
const PRODUCT_PRICES: Record<string, number> = {
  WK001: 699, WK002: 1299, WK003: 2499, WK004: 899, WK005: 3999, WK006: 5999,
  WK007: 599, WK008: 1899, WK009: 799, WK010: 2999, WK011: 4499, WK012: 6999,
  MK001: 899, MK002: 1199, MK003: 2499, MK004: 799, MK005: 3999, MK006: 5499, MK007: 1899, MK008: 2999,
  SAR001: 1299, SAR002: 4999, SAR003: 2499, SAR004: 7999, SAR005: 999, SAR006: 5999,
  DUP001: 499, DUP002: 1299, DUP003: 899, DUP004: 1999, DUP005: 799,
  BAG001: 2499, BAG002: 1999, BAG003: 1499, BAG004: 3999, BAG005: 1299,
  JWL001: 899, JWL002: 2999, JWL003: 1499, JWL004: 5999, JWL005: 799,
  FTW001: 1299, FTW002: 899, FTW003: 2499, FTW004: 1999,
  HOM001: 799, HOM002: 1499, HOM003: 999,
  SCF001: 3999, SCF002: 899,
  GFT001: 2999, GFT002: 4999,
};

interface Customer {
  customer_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  gender: string;
  city: string;
  state: string;
  signup_date: string;
  persona: string;
}

interface Order {
  order_id: string;
  customer_id: string;
  order_date: string;
  products: string; // SKU
  quantity: number;
  amount: number;
  channel: string;
}

function generateCustomerId(index: number): string {
  return `CUST${String(index).padStart(6, '0')}`;
}

function generateOrderId(index: number): string {
  return `ORD${String(index).padStart(7, '0')}`;
}

function clampToPastDate(date: Date): Date {
  return date > TODAY ? new Date(TODAY) : date;
}

function randomDate(startMonthsAgo: number, endMonthsAgo: number): Date {
  const start = new Date(TODAY.getFullYear(), TODAY.getMonth() - startMonthsAgo, 1);
  const end = new Date(TODAY.getFullYear(), TODAY.getMonth() - endMonthsAgo, 28);
  return clampToPastDate(faker.date.between({ from: start, to: end }));
}

function randomPastDate(monthOffsets: number[]): Date {
  const monthOffset = faker.helpers.arrayElement(monthOffsets);
  const year = TODAY.getFullYear() - Math.floor((TODAY.getMonth() - monthOffset) / 12);
  const month = ((TODAY.getMonth() - monthOffset) % 12 + 12) % 12;
  const day = faker.number.int({ min: 1, max: 28 });
  return clampToPastDate(new Date(year, month, day));
}

function assignPersona(index: number): string {
  const cumulative = [
    { type: 'DORMANT_VIP', threshold: CUSTOMER_PERSONAS.DORMANT_VIP },
    { type: 'PREMIUM_LOYALIST', threshold: CUSTOMER_PERSONAS.DORMANT_VIP + CUSTOMER_PERSONAS.PREMIUM_LOYALIST },
    { type: 'DISCOUNT_HUNTER', threshold: CUSTOMER_PERSONAS.DORMANT_VIP + CUSTOMER_PERSONAS.PREMIUM_LOYALIST + CUSTOMER_PERSONAS.DISCOUNT_HUNTER },
    { type: 'CHURN_RISK', threshold: CUSTOMER_PERSONAS.DORMANT_VIP + CUSTOMER_PERSONAS.PREMIUM_LOYALIST + CUSTOMER_PERSONAS.DISCOUNT_HUNTER + CUSTOMER_PERSONAS.CHURN_RISK },
    { type: 'CROSS_SELL', threshold: CUSTOMER_PERSONAS.DORMANT_VIP + CUSTOMER_PERSONAS.PREMIUM_LOYALIST + CUSTOMER_PERSONAS.DISCOUNT_HUNTER + CUSTOMER_PERSONAS.CHURN_RISK + CUSTOMER_PERSONAS.CROSS_SELL },
    { type: 'SEASONAL', threshold: CUSTOMER_PERSONAS.DORMANT_VIP + CUSTOMER_PERSONAS.PREMIUM_LOYALIST + CUSTOMER_PERSONAS.DISCOUNT_HUNTER + CUSTOMER_PERSONAS.CHURN_RISK + CUSTOMER_PERSONAS.CROSS_SELL + CUSTOMER_PERSONAS.SEASONAL },
  ];

  const ratio = index / TOTAL_CUSTOMERS;
  for (const { type, threshold } of cumulative) {
    if (ratio < threshold) return type;
  }
  return 'REGULAR';
}

function generateCustomers(): Customer[] {
  const customers: Customer[] = [];

  for (let i = 0; i < TOTAL_CUSTOMERS; i++) {
    const persona = assignPersona(i);
    const gender = faker.helpers.arrayElement(['Male', 'Female']);
    const firstName = faker.person.firstName(gender.toLowerCase() as 'male' | 'female');
    const lastName = faker.person.lastName();
    const location = faker.helpers.arrayElement(INDIAN_CITIES.slice(0, CITIES));

    // Signup date varies by persona
    let signupDate: Date;
    if (persona === 'DORMANT_VIP' || persona === 'CHURN_RISK') {
      signupDate = randomDate(18, 12);
    } else if (persona === 'PREMIUM_LOYALIST') {
      signupDate = randomDate(15, 8);
    } else {
      signupDate = randomDate(12, 1);
    }

    customers.push({
      customer_id: generateCustomerId(i + 1),
      first_name: firstName,
      last_name: lastName,
      email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@example.com`,
      phone: `+91${faker.string.numeric(10)}`,
      gender,
      city: location.city,
      state: location.state,
      signup_date: signupDate.toISOString().split('T')[0],
      persona
    });
  }

  return customers;
}

function generateOrders(customers: Customer[]): Order[] {
  const orders: Order[] = [];
  let orderIndex = 0;

  for (const customer of customers) {
    const { customer_id, persona } = customer;
    let numOrders = 0;
    let preferredCategory: string | null = null;
    let orderDates: Date[] = [];

    // Generate orders based on persona
    switch (persona) {
      case 'DORMANT_VIP':
        // High spenders who haven't bought in 60-90 days (clear winback opportunity)
        numOrders = faker.number.int({ min: 6, max: 12 });
        orderDates = Array.from({ length: numOrders }, () => randomDate(16, 3));
        break;

      case 'PREMIUM_LOYALIST':
        // Frequent, consistent buyers with high order values (upsell opportunity)
        numOrders = faker.number.int({ min: 8, max: 15 });
        orderDates = Array.from({ length: numOrders }, () => randomDate(12, 0));
        break;

      case 'DISCOUNT_HUNTER':
        // Only buys on sale, low AOV (loyalty program opportunity)
        numOrders = faker.number.int({ min: 4, max: 8 });
        orderDates = Array.from({ length: numOrders }, () => randomDate(12, 0));
        break;

      case 'CHURN_RISK':
        // Was active, now slowing down (retention opportunity)
        numOrders = faker.number.int({ min: 5, max: 10 });
        const oldOrders = Math.floor(numOrders * 0.7);
        orderDates = [
          ...Array.from({ length: oldOrders }, () => randomDate(14, 4)),
          ...Array.from({ length: numOrders - oldOrders }, () => randomDate(3, 0))
        ];
        break;

      case 'CROSS_SELL':
        // Buys only from one category (cross-sell opportunity)
        numOrders = faker.number.int({ min: 4, max: 8 });
        orderDates = Array.from({ length: numOrders }, () => randomDate(10, 0));
        preferredCategory = faker.helpers.arrayElement(Object.keys(PRODUCT_CATEGORIES));
        break;

      case 'SEASONAL':
        // Buys during festivals/seasons (reactivation opportunity)
        numOrders = faker.number.int({ min: 2, max: 4 });
        orderDates = Array.from({ length: numOrders }, () => randomPastDate([1, 2, 4, 5, 8, 9, 11, 12, 14, 15]));
        break;

      case 'REGULAR':
      default:
        // Standard repeat customers
        numOrders = faker.number.int({ min: 3, max: 6 });
        orderDates = Array.from({ length: numOrders }, () => randomDate(12, 0));
        break;
    }

    // Create orders for this customer
    orderDates.sort((a, b) => a.getTime() - b.getTime()); // Chronological order

    for (let i = 0; i < numOrders; i++) {
      const orderDate = orderDates[i];

      // Select products based on persona
      let selectedSKUs: string[];
      if (persona === 'CROSS_SELL' && preferredCategory) {
        // Only buy from one category (90% of time) - cross-sell opportunity
        if (Math.random() > 0.1) {
          selectedSKUs = [faker.helpers.arrayElement((PRODUCT_CATEGORIES as Record<string, { skus: string[]; popular: boolean }>)[preferredCategory].skus)];
        } else {
          selectedSKUs = [faker.helpers.arrayElement(Object.keys(PRODUCT_PRICES))];
        }
      } else if (persona === 'DISCOUNT_HUNTER') {
        // Only buy budget items (price < 1500) - loyalty opportunity
        const budgetSKUs = Object.keys(PRODUCT_PRICES).filter(sku => PRODUCT_PRICES[sku] < 1500);
        selectedSKUs = [faker.helpers.arrayElement(budgetSKUs)];
      } else if (persona === 'PREMIUM_LOYALIST') {
        // Buy premium items (70% high-value) - upsell to ultra-premium
        const premiumSKUs = Object.keys(PRODUCT_PRICES).filter(sku => PRODUCT_PRICES[sku] > 2500);
        const ultraPremiumSKUs = Object.keys(PRODUCT_PRICES).filter(sku => PRODUCT_PRICES[sku] > 5000);
        selectedSKUs = Math.random() > 0.7
          ? [faker.helpers.arrayElement(premiumSKUs)]
          : [faker.helpers.arrayElement(Object.keys(PRODUCT_PRICES))];

        // Premium loyalists often buy multiple items
        if (Math.random() > 0.5) {
          selectedSKUs.push(faker.helpers.arrayElement(premiumSKUs));
        }
        if (Math.random() > 0.7) {
          selectedSKUs.push(faker.helpers.arrayElement(Object.keys(PRODUCT_PRICES)));
        }
      } else if (persona === 'DORMANT_VIP') {
        // Used to buy premium, now dormant - winback opportunity
        const premiumSKUs = Object.keys(PRODUCT_PRICES).filter(sku => PRODUCT_PRICES[sku] > 3000);
        selectedSKUs = Math.random() > 0.6
          ? [faker.helpers.arrayElement(premiumSKUs)]
          : [faker.helpers.arrayElement(Object.keys(PRODUCT_PRICES))];

        // VIPs buy multiple items
        if (Math.random() > 0.6) {
          selectedSKUs.push(faker.helpers.arrayElement(premiumSKUs));
        }
      } else {
        // Random products for regular/seasonal/churn customers
        selectedSKUs = [faker.helpers.arrayElement(Object.keys(PRODUCT_PRICES))];

        // Occasionally add another item
        if (Math.random() > 0.75) {
          selectedSKUs.push(faker.helpers.arrayElement(Object.keys(PRODUCT_PRICES)));
        }
      }

      // Create order for each product
      for (const sku of selectedSKUs) {
        const quantity = faker.number.int({ min: 1, max: 3 });
        const amount = PRODUCT_PRICES[sku] * quantity;
        const channel = faker.helpers.arrayElement(['Website', 'App', 'Store']);

        orders.push({
          order_id: generateOrderId(orderIndex + 1),
          customer_id,
          order_date: orderDate.toISOString().split('T')[0],
          products: sku,
          quantity,
          amount,
          channel
        });

        orderIndex++;
      }
    }
  }

  return orders.slice(0, TARGET_LINE_ITEMS);
}

function saveCSV(filename: string, headers: string[], rows: any[][]) {
  const outputDirs = [
    path.join(__dirname, '../../generated-data'),
    path.join(__dirname, '../../../frontend'),
  ];

  for (const outputDir of outputDirs) {
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const csv = [
      headers.join(','),
      ...rows.map(row => row.map(cell => {
        if (typeof cell === 'string' && (cell.includes(',') || cell.includes('"'))) {
          return `"${cell.replace(/"/g, '""')}"`;
        }
        return cell;
      }).join(','))
    ].join('\n');

    const filepath = path.join(outputDir, filename);
    fs.writeFileSync(filepath, csv);
    console.log(`✅ Generated: ${filepath}`);
  }
}

export async function generateSyntheticData() {
  console.log('🎲 Generating synthetic fashion retail data...\n');
  console.log(
    `Using TOTAL_CUSTOMERS=${TOTAL_CUSTOMERS}, TOTAL_ORDERS=${TARGET_LINE_ITEMS}, ORDER_HISTORY_MONTHS=${ORDER_HISTORY_MONTHS}`,
  );

  // Generate customers
  console.log('👥 Generating customers...');
  const customers = generateCustomers();
  console.log(`✅ Generated ${customers.length} customers`);
  console.log(`   - Dormant VIP: ${customers.filter(c => c.persona === 'DORMANT_VIP').length}`);
  console.log(`   - Premium Loyalists: ${customers.filter(c => c.persona === 'PREMIUM_LOYALIST').length}`);
  console.log(`   - Discount Hunters: ${customers.filter(c => c.persona === 'DISCOUNT_HUNTER').length}`);
  console.log(`   - Churn Risk: ${customers.filter(c => c.persona === 'CHURN_RISK').length}`);
  console.log(`   - Cross-Sell: ${customers.filter(c => c.persona === 'CROSS_SELL').length}`);
  console.log(`   - Seasonal: ${customers.filter(c => c.persona === 'SEASONAL').length}`);
  console.log(`   - Regular: ${customers.filter(c => c.persona === 'REGULAR').length}\n`);

  // Generate orders
  console.log('🛍️  Generating orders...');
  const orders = generateOrders(customers);
  console.log(`✅ Generated ${orders.length} line items\n`);

  // Save to CSV
  console.log('💾 Saving CSV files...');

  saveCSV('customers.csv',
    ['customer_id', 'first_name', 'last_name', 'email', 'phone', 'gender', 'city', 'state', 'signup_date'],
    customers.map(c => [c.customer_id, c.first_name, c.last_name, c.email, c.phone, c.gender, c.city, c.state, c.signup_date])
  );

  saveCSV('orders.csv',
    ['order_id', 'customer_id', 'order_date', 'product_sku', 'quantity', 'amount', 'channel'],
    orders.map(o => [o.order_id, o.customer_id, o.order_date, o.products, o.quantity, o.amount, o.channel])
  );

  console.log('\n🎉 Synthetic data generation complete!');
  console.log(`\n📁 Files saved to: ${path.join(__dirname, '../../generated-data')}`);
}

// Run if called directly
if (require.main === module) {
  generateSyntheticData().catch(console.error);
}

import { createClient } from '@supabase/supabase-js';
import WebSocket from 'ws';
import 'dotenv/config';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey, {
  realtime: {
    transport: WebSocket as any
  }
});

async function testDatabase() {
  console.log('🧪 Phase 1 Database Test\n');

  try {
    // Test 1: Create a customer
    console.log('1️⃣  Creating customer...');
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .insert({
        first_name: 'Sarah',
        last_name: 'Patel',
        email: 'sarah.patel@example.com',
        phone: '+919876543210',
        city: 'Mumbai',
        state: 'Maharashtra',
        gender: 'Female'
      })
      .select()
      .single();

    if (customerError) throw customerError;
    console.log('✅ Customer created:', customer.id);

    // Test 2: Create a product
    console.log('\n2️⃣  Creating product...');
    const { data: product, error: productError } = await supabase
      .from('products')
      .insert({
        sku: 'KURTA-001',
        product_name: 'Blue Cotton Kurta',
        category: 'Kurtas',
        subcategory: 'Women\'s Ethnic Wear',
        price: 1299.00
      })
      .select()
      .single();

    if (productError) throw productError;
    console.log('✅ Product created:', product.id);

    // Test 3: Create an order
    console.log('\n3️⃣  Creating order...');
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        customer_id: customer.id,
        order_date: new Date().toISOString(),
        total_amount: 1299.00,
        channel: 'Website'
      })
      .select()
      .single();

    if (orderError) throw orderError;
    console.log('✅ Order created:', order.id);

    // Test 4: Create order item
    console.log('\n4️⃣  Creating order item...');
    const { data: orderItem, error: orderItemError } = await supabase
      .from('order_items')
      .insert({
        order_id: order.id,
        product_id: product.id,
        quantity: 1,
        unit_price: 1299.00
      })
      .select()
      .single();

    if (orderItemError) throw orderItemError;
    console.log('✅ Order item created:', orderItem.id);

    // Test 5: Create customer metrics
    console.log('\n5️⃣  Creating customer metrics...');
    const { data: metrics, error: metricsError } = await supabase
      .from('customer_metrics')
      .insert({
        customer_id: customer.id,
        total_orders: 1,
        total_spent: 1299.00,
        avg_order_value: 1299.00,
        last_order_date: new Date().toISOString(),
        days_since_last_order: 0,
        purchase_frequency: 'First Purchase'
      })
      .select()
      .single();

    if (metricsError) throw metricsError;
    console.log('✅ Customer metrics created:', metrics.id);

    // Test 6: Query customer with metrics
    console.log('\n6️⃣  Querying customer with metrics...');
    const { data: customerWithMetrics, error: queryError } = await supabase
      .from('customers')
      .select(`
        id,
        first_name,
        last_name,
        email,
        customer_metrics (
          total_orders,
          total_spent,
          avg_order_value
        )
      `)
      .eq('id', customer.id)
      .single();

    if (queryError) throw queryError;
    console.log('✅ Customer query successful:', customerWithMetrics);

    console.log('\n🎉 All Phase 1 tests passed!\n');
    console.log('✅ Can create customers');
    console.log('✅ Can create products');
    console.log('✅ Can create orders');
    console.log('✅ Can create order items');
    console.log('✅ Can create customer metrics');
    console.log('✅ Can query data with relationships');

    console.log('\n📊 Phase 1 Database: READY ✅\n');

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

testDatabase();

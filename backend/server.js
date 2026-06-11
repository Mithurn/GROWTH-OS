console.log('[1] Starting server...');
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Manually load .env
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  envContent.split('\n').forEach(line => {
    line = line.trim();
    if (line && !line.startsWith('#')) {
      const [key, ...valueParts] = line.split('=');
      if (key && valueParts.length > 0) {
        let value = valueParts.join('=');
        // Remove quotes if present
        value = value.replace(/^["']|["']$/g, '');
        process.env[key] = value;
      }
    }
  });
  console.log('[1.5] Environment loaded');
}

console.log('[2] Creating Express app');
const app = express();
app.use(cors());
app.use(express.json());

console.log('[3] Creating Supabase client');
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('[4] Registering routes');

// Test endpoint
app.get('/api/test', (req, res) => {
  res.json({ status: 'ok', message: 'Backend is running!' });
});

// Intelligence preview endpoint
app.get('/api/intelligence-preview', async (req, res) => {
  try {
    const { count: totalCustomers } = await supabase
      .from('customers')
      .select('*', { count: 'exact', head: true });

    const { count: totalOrders } = await supabase
      .from('orders')
      .select('*', { count: 'exact', head: true });

    const { data: revenueData } = await supabase
      .from('orders')
      .select('total_amount');

    const revenue = revenueData?.reduce((sum, o) => sum + parseFloat(o.total_amount.toString()), 0) || 0;
    const avgOrderValue = totalOrders ? revenue / totalOrders : 0;

    const active = Math.floor(totalCustomers * 0.68);
    const dormant = Math.floor(totalCustomers * 0.12);
    const atRisk = totalCustomers - active - dormant;

    const { data: topCustomers } = await supabase
      .from('customer_metrics')
      .select('customer_id, total_spent, customers(first_name, last_name)')
      .order('total_spent', { ascending: false })
      .limit(3);

    res.json({
      totalCustomers,
      totalOrders,
      revenue,
      avgOrderValue,
      customerHealth: { active, dormant, atRisk },
      topCustomers: topCustomers?.map(c => ({
        name: `${c.customers.first_name} ${c.customers.last_name}`,
        totalSpent: c.total_spent
      })) || []
    });
  } catch (error) {
    console.error('Error fetching intelligence:', error);
    res.status(500).json({ error: 'Failed to fetch intelligence' });
  }
});

console.log('[5] Starting server on port 3001');
const PORT = 3001;
app.listen(PORT, () => {
  console.log(`🚀 Backend server running on http://localhost:${PORT}`);
});

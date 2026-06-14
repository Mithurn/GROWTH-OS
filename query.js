const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'backend/.env' });
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
async function run() {
  const { data } = await supabase.from('communication_events').select('*').order('created_at', { ascending: false }).limit(5);
  console.log(data);
}
run();

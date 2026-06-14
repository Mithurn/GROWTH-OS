import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: '/Users/mithurnjeromme/Desktop/xeno-grow/backend/.env' });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function test() {
  const { data, error } = await supabase
    .from('communications')
    .select('id, customer_id, channel, message, customers(email, phone)')
    .limit(1);

  console.log('Result:', { data, error });
}

test();

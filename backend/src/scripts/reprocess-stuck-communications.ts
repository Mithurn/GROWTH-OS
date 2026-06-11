import { createClient } from '@supabase/supabase-js';
import WebSocket from 'ws';
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    realtime: {
      transport: WebSocket as any
    }
  }
);

const CHANNEL_SERVICE_URL = process.env.CHANNEL_SERVICE_URL || 'http://localhost:5001';

async function reprocessStuckCommunications() {
  console.log('🔍 Finding stuck communications...\n');

  // Find communications that are QUEUED with no provider_message_id
  const { data: stuckComms, error: fetchError } = await supabase
    .from('communications')
    .select('id, campaign_id, customer_id, channel, message, status, customers(email, phone)')
    .eq('status', 'QUEUED')
    .is('provider_message_id', null);

  if (fetchError) {
    console.error('Error fetching stuck communications:', fetchError);
    process.exit(1);
  }

  if (!stuckComms || stuckComms.length === 0) {
    console.log('✅ No stuck communications found!');
    process.exit(0);
  }

  console.log(`📋 Found ${stuckComms.length} stuck communications\n`);

  let sent = 0;
  let failed = 0;

  for (const comm of stuckComms) {
    try {
      const customer = (comm as any).customers;
      const recipient = comm.channel === 'Email' ? customer?.email : customer?.phone;

      if (!recipient) {
        console.warn(`⚠️  Skipping ${comm.id}: No ${comm.channel === 'Email' ? 'email' : 'phone'}`);
        failed++;
        continue;
      }

      // Send to Channel Service
      const response = await fetch(`${CHANNEL_SERVICE_URL}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          communicationId: comm.id,
          recipient,
          channel: comm.channel,
          content: comm.message,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const result = await response.json();

      // Update with provider message ID
      await supabase
        .from('communications')
        .update({ provider_message_id: result.providerMessageId })
        .eq('id', comm.id);

      console.log(`✅ Sent ${comm.channel} to ${recipient}: ${result.providerMessageId}`);
      sent++;
    } catch (error) {
      console.error(`❌ Failed ${comm.id}:`, error);
      failed++;
    }
  }

  console.log(`\n📊 Results:`);
  console.log(`   Sent: ${sent}`);
  console.log(`   Failed: ${failed}`);
  console.log(`\n✅ Reprocessing complete!`);
}

reprocessStuckCommunications().catch(console.error);

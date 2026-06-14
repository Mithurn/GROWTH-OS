const { createClient } = require('@supabase/supabase-js');
const { processWebhook } = require('./dist/services/webhooks'); // wait, the backend isn't compiled... let's use ts-node or tsx

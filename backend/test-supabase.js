require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

async function run() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabase = createClient(supabaseUrl, supabaseKey);

  const oppId = "86ebe27a-fae2-475d-8e15-6412e2e9fcd0";
  const compId = "b4864788-ec6f-43aa-a9d8-fd53bf328b1b";

  console.log("Inserting...");
  const { data, error } = await supabase
    .from('campaigns')
    .insert({
      company_id: compId,
      opportunity_id: oppId,
      name: "Test Campaign",
      objective: "Test",
      channel: "WhatsApp",
      offer: "None",
      message_angle: "Test",
      message_content: "Test message",
      expected_outcome: "Test",
      reasoning: "Test",
      status: "Draft",
    })
    .select()
    .single();

  if (error) {
    console.error("Error:", error);
  } else {
    console.log("Success:", data.id);
  }
}
run();

import { SupabaseClient } from '@supabase/supabase-js';
import { openai, openRouterConfig } from '../config/openrouter';
import { logger } from '../lib/logger';


const SYSTEM_PROMPT = `You are a friendly onboarding assistant for GrowthOS, an AI-powered customer growth platform.

Your goal is to gather important context about the user's business goals in a natural, conversational way. You need to understand:

1. **Priority**: What's their biggest growth priority? (e.g., increase repeat purchases, reduce churn, grow loyalty, increase AOV, drive store visits)
2. **Audience**: Which customer segment should they focus on? (e.g., high-value customers, at-risk customers, recent buyers, loyalty members, all customers)
3. **Engagement**: How should they engage customers? (e.g., personalized recommendations, loyalty rewards, promotional offers, product discovery, reactivation campaigns)
4. **Channels**: Which communication channels to use? (WhatsApp, Email, SMS, RCS)
5. **Involvement**: How involved do they want to be? (review every campaign, review major campaigns only, or autopilot)

**Important Guidelines:**
- Start with a warm greeting and ask about their main goal
- Keep responses SHORT and conversational (1-2 sentences max)
- If their response is clear, acknowledge it and move to the next topic naturally
- If their response is vague, ask a clarifying question
- Offer 2-3 relevant quick reply options when helpful
- After gathering enough context (or max 4 exchanges), wrap up warmly
- Extract structured data as you go

**Quick Reply Format:**
When offering options, format them as: [QUICK_REPLIES: Option 1 | Option 2 | Option 3]

**Completion Signal:**
When you have enough information, end with: [CONVERSATION_COMPLETE]

Remember: Be conversational, not robotic. Sound like a helpful human, not a form.`;

export interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  quickReplies?: string[];
}

export interface ExtractedData {
  priority?: string[];
  audience?: string[];
  engagement?: string[];
  channels?: string[];
  involvement?: string[];
}

export interface ConversationState {
  id: string;
  companyId: string;
  messages: Message[];
  extractedData: ExtractedData;
  completed: boolean;
}

export async function startConversation(
  supabase: SupabaseClient,
  companyId: string,
): Promise<ConversationState> {
  // Create initial AI greeting
  const initialMessage = await generateAIMessage([]);

  const messages: Message[] = [
    {
      role: 'assistant',
      content: initialMessage.content,
      timestamp: new Date().toISOString(),
      quickReplies: initialMessage.quickReplies,
    },
  ];

  const { data, error } = await supabase
    .from('onboarding_conversations')
    .insert({
      company_id: companyId,
      messages,
      extracted_data: {},
      completed: false,
    })
    .select()
    .single();

  if (error) throw error;

  return {
    id: data.id,
    companyId: data.company_id,
    messages: data.messages,
    extractedData: data.extracted_data || {},
    completed: data.completed,
  };
}

export async function sendMessage(
  supabase: SupabaseClient,
  conversationId: string,
  userMessage: string,
): Promise<ConversationState> {
  // Get current conversation
  const { data: conversation, error: fetchError } = await supabase
    .from('onboarding_conversations')
    .select('*')
    .eq('id', conversationId)
    .single();

  if (fetchError) throw fetchError;

  const messages: Message[] = conversation.messages || [];

  // Add user message
  messages.push({
    role: 'user',
    content: userMessage,
    timestamp: new Date().toISOString(),
  });

  // Generate AI response
  const aiResponse = await generateAIMessage(messages);

  // Add AI message
  messages.push({
    role: 'assistant',
    content: aiResponse.content,
    timestamp: new Date().toISOString(),
    quickReplies: aiResponse.quickReplies,
  });

  // Check if conversation is complete
  const completed = aiResponse.completed;

  // Extract structured data if complete
  let extractedData = conversation.extracted_data || {};
  if (completed) {
    extractedData = await extractStructuredData(messages);
  }

  // Update conversation
  const { data: updated, error: updateError } = await supabase
    .from('onboarding_conversations')
    .update({
      messages,
      extracted_data: extractedData,
      completed,
      updated_at: new Date().toISOString(),
    })
    .eq('id', conversationId)
    .select()
    .single();

  if (updateError) throw updateError;

  return {
    id: updated.id,
    companyId: updated.company_id,
    messages: updated.messages,
    extractedData: updated.extracted_data || {},
    completed: updated.completed,
  };
}

async function generateAIMessage(
  messages: Message[],
): Promise<{ content: string; quickReplies?: string[]; completed: boolean }> {
  const conversationHistory = messages.map((msg) => ({
    role: msg.role,
    content: msg.content,
  }));

  const completion = await openai.chat.completions.create({
    model: openRouterConfig.defaultModel,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      ...conversationHistory,
    ],
    temperature: 0.7,
    max_tokens: 200,
  });

  const response = completion.choices[0].message.content || '';

  // Check if conversation is complete
  const completed = response.includes('[CONVERSATION_COMPLETE]');

  // Extract quick replies
  const quickRepliesMatch = response.match(/\[QUICK_REPLIES:\s*([^\]]+)\]/);
  const quickReplies = quickRepliesMatch
    ? quickRepliesMatch[1].split('|').map((s) => s.trim())
    : undefined;

  // Clean up the response
  let cleanContent = response
    .replace(/\[CONVERSATION_COMPLETE\]/g, '')
    .replace(/\[QUICK_REPLIES:[^\]]+\]/g, '')
    .trim();

  return {
    content: cleanContent,
    quickReplies,
    completed,
  };
}

async function extractStructuredData(messages: Message[]): Promise<ExtractedData> {
  const conversationText = messages
    .map((msg) => `${msg.role}: ${msg.content}`)
    .join('\n');

  const extractionPrompt = `Based on this onboarding conversation, extract structured data about the user's preferences.

Conversation:
${conversationText}

Extract and return ONLY a valid JSON object with these fields (use arrays for all values):
{
  "priority": ["their main growth priority"],
  "audience": ["target customer segment"],
  "engagement": ["engagement approach"],
  "channels": ["selected channels like WhatsApp, Email, SMS, RCS"],
  "involvement": ["their preferred involvement level"]
}

If any field is unclear, use an empty array. Return ONLY the JSON, no other text.`;

  const completion = await openai.chat.completions.create({
    model: openRouterConfig.defaultModel,
    messages: [{ role: 'user', content: extractionPrompt }],
    temperature: 0.3,
    max_tokens: 300,
  });

  const response = completion.choices[0].message.content || '{}';

  try {
    // Extract JSON from response (in case there's extra text)
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    const jsonStr = jsonMatch ? jsonMatch[0] : response;
    const extracted = JSON.parse(jsonStr);

    return {
      priority: Array.isArray(extracted.priority) ? extracted.priority : [],
      audience: Array.isArray(extracted.audience) ? extracted.audience : [],
      engagement: Array.isArray(extracted.engagement) ? extracted.engagement : [],
      channels: Array.isArray(extracted.channels) ? extracted.channels : ['WhatsApp', 'Email'],
      involvement: Array.isArray(extracted.involvement) ? extracted.involvement : [],
    };
  } catch (error) {
    logger.error({ err: error }, 'Failed to parse extracted data');
    // Return default values
    return {
      priority: [],
      audience: [],
      engagement: [],
      channels: ['WhatsApp', 'Email'],
      involvement: [],
    };
  }
}

export async function getConversation(
  supabase: SupabaseClient,
  conversationId: string,
): Promise<ConversationState | null> {
  const { data, error } = await supabase
    .from('onboarding_conversations')
    .select('*')
    .eq('id', conversationId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }

  return {
    id: data.id,
    companyId: data.company_id,
    messages: data.messages,
    extractedData: data.extracted_data || {},
    completed: data.completed,
  };
}

import express from 'express';
import 'dotenv/config';
import { v4 as uuidv4 } from 'uuid';
import { queueMessage, getMessageStatus, getAllMessages, messageRegistry, updateRegistryStatus } from './queue';
import { sendWebhook } from './webhook';
import { SequenceNumbers } from './types';
import type { SendRequest, CommunicationStatus } from './types';

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 5001;

// ── Send ──────────────────────────────────────────────────────────────────────

app.post('/send', async (req, res) => {
  try {
    const { communicationId, recipient, channel, content } = req.body as SendRequest;

    if (!communicationId || !recipient || !channel || !content) {
      return res.status(400).json({
        error: 'Missing required fields: communicationId, recipient, channel, content',
      });
    }

    if (!['WhatsApp', 'Email', 'SMS'].includes(channel)) {
      return res.status(400).json({ error: 'Invalid channel. Must be WhatsApp, Email, or SMS' });
    }

    const providerMessageId = await queueMessage({ communicationId, recipient, channel, content });

    res.status(202).json({ accepted: true, providerMessageId, message: 'Communication accepted for delivery' });
  } catch (error) {
    console.error('[Server] Error accepting message:', error);
    res.status(500).json({ error: 'Failed to accept message' });
  }
});

// ── Twilio delivery status callback ──────────────────────────────────────────
// Twilio POSTs form-encoded data to this endpoint for each status transition.
// We translate to our status model and forward to the backend webhook.

const TWILIO_STATUS_MAP: Record<string, CommunicationStatus | null> = {
  queued:      'QUEUED',
  sending:     null,        // internal Twilio state, skip
  sent:        'SENT',
  delivered:   'DELIVERED',
  read:        'READ',
  undelivered: 'FAILED',
  failed:      'FAILED',
};

app.post('/webhooks/twilio', express.urlencoded({ extended: false }), async (req, res) => {
  try {
    const { MessageSid, MessageStatus } = req.body as { MessageSid: string; MessageStatus: string };
    if (!MessageSid || !MessageStatus) return res.sendStatus(200);

    const entry = messageRegistry.get(MessageSid);
    if (!entry) return res.sendStatus(200); // unknown message — ignore

    const ourStatus = TWILIO_STATUS_MAP[MessageStatus];
    if (!ourStatus) return res.sendStatus(200); // no-op status

    updateRegistryStatus(MessageSid, ourStatus);
    await sendWebhook({
      eventId:          uuidv4(),
      providerMessageId: MessageSid,
      communicationId:  entry.communicationId,
      status:           ourStatus,
      timestamp:        new Date().toISOString(),
      sequenceNumber:   SequenceNumbers[ourStatus],
    });

    res.sendStatus(200);
  } catch (err) {
    console.error('[Twilio webhook] Error:', err);
    res.sendStatus(200); // always 200 so Twilio doesn't retry indefinitely
  }
});

// ── Resend delivery event webhook ─────────────────────────────────────────────
// Resend POSTs JSON events to this endpoint (configure in Resend dashboard).

const RESEND_EVENT_MAP: Record<string, CommunicationStatus | null> = {
  'email.sent':              'SENT',
  'email.delivered':         'DELIVERED',
  'email.opened':            'READ',
  'email.clicked':           'CLICKED',
  'email.bounced':           'FAILED',
  'email.delivery_delayed':  null,
  'email.complained':        null,
  'email.unsubscribed':      null,
};

app.post('/webhooks/resend', async (req, res) => {
  try {
    const { type, data } = req.body as { type: string; data: { email_id?: string } };
    const messageId = data?.email_id;
    if (!messageId) return res.sendStatus(200);

    const entry = messageRegistry.get(messageId);
    if (!entry) return res.sendStatus(200);

    const ourStatus = RESEND_EVENT_MAP[type];
    if (!ourStatus) return res.sendStatus(200);

    updateRegistryStatus(messageId, ourStatus);
    await sendWebhook({
      eventId:          uuidv4(),
      providerMessageId: messageId,
      communicationId:  entry.communicationId,
      status:           ourStatus,
      timestamp:        new Date().toISOString(),
      sequenceNumber:   SequenceNumbers[ourStatus],
    });

    res.sendStatus(200);
  } catch (err) {
    console.error('[Resend webhook] Error:', err);
    res.sendStatus(200);
  }
});

// ── Debug endpoints ───────────────────────────────────────────────────────────

app.get('/status/:providerMessageId', (req, res) => {
  const message = getMessageStatus(req.params.providerMessageId);
  if (!message) return res.status(404).json({ error: 'Message not found' });
  res.json({
    providerMessageId: message.providerMessageId,
    status:           message.status,
    sequenceNumber:   message.sequenceNumber,
    channel:          message.channel,
    createdAt:        message.createdAt,
    lastUpdatedAt:    message.lastUpdatedAt,
  });
});

app.get('/messages', (_req, res) => {
  const messages = getAllMessages();
  res.json({
    total: messages.length,
    messages: messages.map((msg) => ({
      providerMessageId: msg.providerMessageId,
      communicationId:  msg.communicationId,
      status:           msg.status,
      sequenceNumber:   msg.sequenceNumber,
      channel:          msg.channel,
      recipient:        msg.recipient,
      createdAt:        msg.createdAt,
      lastUpdatedAt:    msg.lastUpdatedAt,
    })),
  });
});

app.get('/health', (_req, res) => {
  const activeProviders: string[] = [];
  if (process.env.RESEND_API_KEY)    activeProviders.push('resend (email)');
  if (process.env.TWILIO_ACCOUNT_SID) {
    if (process.env.TWILIO_PHONE_NUMBER)    activeProviders.push('twilio (sms)');
    if (process.env.TWILIO_WHATSAPP_NUMBER) activeProviders.push('twilio (whatsapp)');
  }
  if (activeProviders.length === 0)  activeProviders.push('simulator (all channels)');

  res.json({ status: 'healthy', service: 'channel-service', uptime: process.uptime(), activeProviders });
});

// ── Boot ──────────────────────────────────────────────────────────────────────

app.listen(Number(PORT), '0.0.0.0', () => {
  console.log(`\n📡 Channel Service running on http://0.0.0.0:${PORT}`);

  const backendUrl = (process.env.CRM_WEBHOOK_URL || '').replace('/api/webhooks/channel-status', '');
  if (backendUrl) {
    fetch(`${backendUrl}/health`)
      .then(() => console.log('[Startup] Backend wake ping sent'))
      .catch(() => {});
  }
});

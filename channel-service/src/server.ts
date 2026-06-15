import express from 'express';
import 'dotenv/config';
import { queueMessage, getMessageStatus, getAllMessages } from './queue';
import type { SendRequest } from './types';

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 5001;

// POST /send - Accept communication for delivery
app.post('/send', (req, res) => {
  try {
    const { communicationId, recipient, channel, content } = req.body as SendRequest;

    // Validate request
    if (!communicationId || !recipient || !channel || !content) {
      return res.status(400).json({
        error: 'Missing required fields: communicationId, recipient, channel, content',
      });
    }

    if (!['WhatsApp', 'Email', 'SMS'].includes(channel)) {
      return res.status(400).json({
        error: 'Invalid channel. Must be WhatsApp, Email, or SMS',
      });
    }

    // Queue the message for async processing
    const providerMessageId = queueMessage({
      communicationId,
      recipient,
      channel,
      content,
    });

    // Return 202 Accepted immediately
    res.status(202).json({
      accepted: true,
      providerMessageId,
      message: 'Communication accepted for delivery',
    });
  } catch (error) {
    console.error('Error accepting message:', error);
    res.status(500).json({ error: 'Failed to accept message' });
  }
});

// GET /status/:providerMessageId - Check message status (for debugging)
app.get('/status/:providerMessageId', (req, res) => {
  const { providerMessageId } = req.params;
  const message = getMessageStatus(providerMessageId);

  if (!message) {
    return res.status(404).json({ error: 'Message not found' });
  }

  res.json({
    providerMessageId: message.providerMessageId,
    status: message.status,
    sequenceNumber: message.sequenceNumber,
    channel: message.channel,
    createdAt: message.createdAt,
    lastUpdatedAt: message.lastUpdatedAt,
  });
});

// GET /messages - List all messages (for debugging)
app.get('/messages', (req, res) => {
  const messages = getAllMessages();

  res.json({
    total: messages.length,
    messages: messages.map((msg) => ({
      providerMessageId: msg.providerMessageId,
      communicationId: msg.communicationId,
      status: msg.status,
      sequenceNumber: msg.sequenceNumber,
      channel: msg.channel,
      recipient: msg.recipient,
      createdAt: msg.createdAt,
      lastUpdatedAt: msg.lastUpdatedAt,
    })),
  });
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'channel-service',
    uptime: process.uptime(),
  });
});

app.listen(Number(PORT), '0.0.0.0', () => {
  console.log(`\n📡 Channel Service running on http://0.0.0.0:${PORT}`);
  console.log(`\n✓ Webhook endpoint: ${process.env.CRM_WEBHOOK_URL}`);
  console.log(`✓ Supported channels: WhatsApp, Email, SMS`);
  console.log(`✓ Failure rate: ${process.env.FAILURE_RATE}%`);
  console.log(`\n🚀 Ready to receive messages via POST /send\n`);
});

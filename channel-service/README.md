# Channel Service

A simulated messaging channel provider for WhatsApp, Email, and SMS communications. This service demonstrates production-ready patterns for webhook-based integrations.

## Overview

The Channel Service simulates the behavior of real messaging providers (like Twilio, SendGrid, WhatsApp Business API) by:

1. **Accepting messages** via REST API (returns 202 Accepted immediately)
2. **Processing asynchronously** through realistic state transitions
3. **Sending webhooks** to notify the CRM of status changes
4. **Implementing retry logic** for reliable webhook delivery

## Architecture

```
┌──────────────┐      POST /send       ┌─────────────────┐
│     CRM      │─────────────────────▶│  HTTP Server    │
│   Backend    │◀─────────────────────│   (Express)     │
└──────────────┘   Webhook Callbacks   └─────────────────┘
                                              │
                                              ▼
                                       ┌─────────────────┐
                                       │  Message Queue  │
                                       │  (In-Memory)    │
                                       └─────────────────┘
                                              │
                                              ▼
                                       ┌─────────────────┐
                                       │ State Machine   │
                                       │  Processor      │
                                       └─────────────────┘
                                              │
                                              ▼
                                       ┌─────────────────┐
                                       │  Webhook Sender │
                                       │  (with retry)   │
                                       └─────────────────┘
```

## State Machine

Messages progress through the following states:

```
QUEUED (seq 1)
   │
   │ wait 2s
   ▼
SENT (seq 2)
   │
   │ wait 3s
   ▼
DELIVERED (seq 3) ─────── 10% ────────▶ FAILED (seq 3)
   │                                         [END]
   │ 60% chance
   ▼
READ (seq 4)
   │
   │ 20% chance
   ▼
CLICKED (seq 5)
   [END]
```

**Sequence Numbers:**
- QUEUED: 1
- SENT: 2
- DELIVERED: 3
- READ: 4
- CLICKED: 5
- FAILED: 3 (same as DELIVERED for ordering)

## API Reference

### POST /send

Accept a message for delivery.

**Request:**
```json
{
  "communicationId": "uuid-from-crm",
  "recipient": "user@example.com" | "+1234567890",
  "channel": "WhatsApp" | "Email" | "SMS",
  "content": "Message text"
}
```

**Response: 202 Accepted**
```json
{
  "accepted": true,
  "providerMessageId": "wa_msg_1781208693740_zks0y1",
  "message": "Communication accepted for delivery"
}
```

**Validation:**
- All fields are required
- Channel must be one of: WhatsApp, Email, SMS

---

### GET /status/:providerMessageId

Check the status of a message.

**Response: 200 OK**
```json
{
  "providerMessageId": "wa_msg_1781208693740_zks0y1",
  "status": "DELIVERED",
  "sequenceNumber": 3,
  "channel": "WhatsApp",
  "createdAt": "2026-06-11T20:10:18.769Z",
  "lastUpdatedAt": "2026-06-11T20:10:23.806Z"
}
```

**Response: 404 Not Found**
```json
{
  "error": "Message not found"
}
```

---

### GET /messages

List all messages in the queue (for debugging).

**Response: 200 OK**
```json
{
  "total": 18,
  "messages": [
    {
      "providerMessageId": "wa_msg_1781208693740_zks0y1",
      "communicationId": "740157de-eff6-48b2-bb7f-a31ccca0c8ec",
      "status": "READ",
      "sequenceNumber": 4,
      "channel": "WhatsApp",
      "recipient": "+919876543210",
      "createdAt": "2026-06-11T20:10:18.769Z",
      "lastUpdatedAt": "2026-06-11T20:10:28.806Z"
    }
  ]
}
```

---

### GET /health

Health check endpoint.

**Response: 200 OK**
```json
{
  "status": "healthy",
  "service": "channel-service",
  "uptime": 144.345609
}
```

## Webhooks

### Webhook Format

The Channel Service sends webhooks to the CRM at each state transition.

**Endpoint:** `process.env.CRM_WEBHOOK_URL`
**Method:** POST
**Headers:**
```
Content-Type: application/json
X-Signature: <HMAC-SHA256-signature>
```

**Body:**
```json
{
  "eventId": "uuid-unique-event-id",
  "providerMessageId": "wa_msg_1781208693740_zks0y1",
  "communicationId": "740157de-eff6-48b2-bb7f-a31ccca0c8ec",
  "status": "DELIVERED",
  "timestamp": "2026-06-11T20:10:23.806Z",
  "sequenceNumber": 3
}
```

### Signature Verification

Webhooks are signed using HMAC SHA256:

```typescript
const signature = crypto
  .createHmac('sha256', WEBHOOK_SECRET)
  .update(JSON.stringify(payload))
  .digest('hex');
```

The CRM should verify this signature to ensure webhooks are authentic:

```typescript
const expectedSignature = crypto
  .createHmac('sha256', WEBHOOK_SECRET)
  .update(payload)
  .digest('hex');

const isValid = crypto.timingSafeEqual(
  Buffer.from(signature),
  Buffer.from(expectedSignature)
);
```

### Retry Logic

If a webhook fails (non-200 response), the Channel Service retries with exponential backoff:

1. **First retry:** 5 seconds
2. **Second retry:** 15 seconds
3. **Third retry:** 30 seconds
4. **Give up:** After 3 failed attempts

## Configuration

Environment variables in `.env`:

```env
# Server
PORT=5001                    # Port to listen on

# Webhook
CRM_WEBHOOK_URL=http://localhost:3001/api/webhooks/channel-status
WEBHOOK_SECRET=xeno-webhook-secret-dev

# State transition delays (milliseconds)
QUEUED_TO_SENT_DELAY=2000
SENT_TO_DELIVERED_DELAY=3000
DELIVERED_TO_READ_DELAY=4000
READ_TO_CLICKED_DELAY=5000

# Retry delays (milliseconds)
RETRY_DELAY_1=5000
RETRY_DELAY_2=15000
RETRY_DELAY_3=30000

# Failure simulation
FAILURE_RATE=10              # Percentage (0-100)
```

## Installation

```bash
npm install
```

## Running

### Development (with auto-reload)
```bash
npm run dev
```

### Production
```bash
npm start
```

## Testing

### Quick Test
```bash
curl -X POST http://localhost:5001/send \
  -H "Content-Type: application/json" \
  -d '{
    "communicationId": "test-123",
    "recipient": "test@example.com",
    "channel": "Email",
    "content": "Hello World"
  }'
```

**Expected Response:**
```json
{
  "accepted": true,
  "providerMessageId": "email_msg_1781208618769_65iw4m",
  "message": "Communication accepted for delivery"
}
```

### Check Status
```bash
curl http://localhost:5001/status/email_msg_1781208618769_65iw4m
```

### View All Messages
```bash
curl http://localhost:5001/messages | jq .
```

## Provider Message ID Format

The service generates unique provider message IDs based on channel:

- **WhatsApp:** `wa_msg_{timestamp}_{random}`
- **Email:** `email_msg_{timestamp}_{random}`
- **SMS:** `sms_msg_{timestamp}_{random}`

Example: `wa_msg_1781208693740_zks0y1`

## Realistic Behavior

The service simulates real-world messaging provider behavior:

### Delivery Success Rate
- **90% delivered** - Most messages reach recipients
- **10% failed** - Some messages fail (invalid recipient, service error, etc.)

### Engagement Rates
- **60% of delivered messages are read**
- **20% of read messages are clicked** (if they contain links)

### Timing
- Messages don't process instantly (configurable delays)
- Webhooks arrive asynchronously
- Retry logic handles transient failures

## Production Patterns

This service demonstrates several production-ready patterns:

### 1. Asynchronous Processing
- Returns 202 Accepted immediately
- Processes messages in background
- Doesn't block the calling service

### 2. Webhook Security
- HMAC signature on all webhooks
- Shared secret between services
- Prevents webhook spoofing

### 3. Idempotency
- Each webhook has unique eventId
- CRM can safely retry operations
- Duplicate events can be detected

### 4. Reliability
- Automatic retry with exponential backoff
- Handles transient network failures
- Logs all retry attempts

### 5. Observability
- Comprehensive logging
- Status endpoints for debugging
- Message queue visibility

## File Structure

```
channel-service/
├── package.json         # Dependencies
├── .env                 # Configuration
├── src/
│   ├── server.ts        # Express app and endpoints
│   ├── queue.ts         # Message queue and state machine
│   ├── webhook.ts       # Webhook sender with retry logic
│   └── types.ts         # TypeScript types
└── README.md            # This file
```

## Dependencies

- **express** - HTTP server
- **dotenv** - Environment configuration
- **uuid** - Unique event IDs
- **tsx** - TypeScript execution (dev)
- **typescript** - Type checking

## Limitations

### In-Memory Storage
- Messages are stored in memory (Map)
- Restart clears all messages
- Not suitable for production scale

**Production Alternative:**
- Use Redis for queue storage
- Implement job queue (Bull, BullMQ)
- Add persistence layer

### No Authentication
- No API key or authentication
- Assumes trusted network
- All endpoints are public

**Production Alternative:**
- Require API key on POST /send
- Rate limiting
- IP allowlisting

### Single Instance
- No clustering support
- No load balancing
- Single point of failure

**Production Alternative:**
- Run multiple instances behind load balancer
- Use distributed queue (RabbitMQ, Kafka)
- Share state via Redis

## Future Enhancements

1. **Persistence** - Store messages in database
2. **Authentication** - API keys for /send endpoint
3. **Rate Limiting** - Prevent abuse
4. **Message Templates** - Support for rich messages
5. **Delivery Reports** - Detailed failure reasons
6. **Channel-Specific Behavior** - Different timing per channel
7. **Batch Sending** - Accept multiple messages at once
8. **Priority Queue** - High-priority message support
9. **Dead Letter Queue** - Handle permanently failed messages
10. **Metrics** - Prometheus/Grafana integration

## License

MIT

## Support

For issues or questions, contact the development team.

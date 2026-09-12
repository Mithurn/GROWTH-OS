<h1 align="center">
  <br>
  <img width="120" height="120" alt="Xeno Growth OS" src="https://xeno-grow.vercel.app/logo.png" />
  <br>
  Xeno Growth OS — Channel Service
  <br>
</h1>

<h4 align="center">A standalone delivery simulator that models the full async lifecycle of a real messaging provider — without sending a single real message.</h4>

<p align="center">
  <img src="https://img.shields.io/badge/Node.js-18+-339933?style=flat-square&logo=node.js" alt="Node.js">
  <img src="https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript" alt="TypeScript">
  <img src="https://img.shields.io/badge/Express.js-4-000000?style=flat-square&logo=express" alt="Express">
  <img src="https://img.shields.io/badge/Channels-WhatsApp_·_Email_·_SMS-25D366?style=flat-square" alt="Channels">
  <img src="https://img.shields.io/badge/Deployed-Render-46E3B7?style=flat-square" alt="Render">
</p>

<p align="center">
  <a href="#why-a-separate-service">Why Separate</a> •
  <a href="#delivery-lifecycle">Delivery Lifecycle</a> •
  <a href="#webhook-contract">Webhook Contract</a> •
  <a href="#configuration">Configuration</a> •
  <a href="#setup">Setup</a>
</p>

**Production URL:** https://xeno-channel-service.onrender.com

> Runs on Render's free tier and is deliberately **not** kept warm. Render's 750 free
> instance-hours are shared workspace-wide, and keeping the backend warm 24/7 already
> consumes ~730 of them. This service spins down when idle and is woken on demand by the
> backend immediately before a campaign launch fans out its sends.

---

## Why a Separate Service

This is a **deliberately separate process** — not a module inside the backend.

Real-world CRMs integrate with messaging providers like Twilio, Gupshup, or Kaleyra over HTTP. The CRM sends a message, the provider delivers it asynchronously, and fires webhooks back with each status update (delivered, read, clicked). The CRM and the provider are two independent services.

This channel service models that exact architecture. Swapping the simulator for a real provider (Twilio) requires **zero changes to the CRM backend** — just point `CHANNEL_SERVICE_URL` at the real endpoint.

---

## Delivery Lifecycle

Each message accepted via `POST /send` goes through a stochastic async pipeline:

```
POST /send → 202 Accepted (immediate)
                ↓
         [in-memory queue]
                ↓ ~2s
            SENT (seq 2)  ──────────────────────► webhook → backend
                ↓
         10% failure rate
         ├── FAILED (seq 3) ────────────────────► webhook → backend
         └── DELIVERED (seq 3) ─────────────────► webhook → backend
                    ↓ ~4s
               60% read rate
               READ (seq 4) ──────────────────► webhook → backend
                    ↓ ~5s
               20% click rate
               CLICKED (seq 5) ──────────────► webhook → backend
```

All timing and rates are configurable via environment variables.

---

## Webhook Contract

Every status update fires a `POST` to the backend's `CRM_WEBHOOK_URL` with:

```json
{
  "eventId": "uuid-v4",
  "providerMessageId": "email_msg_1781519576454_abc123",
  "communicationId": "uuid-from-backend",
  "status": "DELIVERED",
  "timestamp": "2026-06-15T10:22:34.123Z",
  "sequenceNumber": 3
}
```

**Security:** Every payload is signed with HMAC-SHA256 using the shared `WEBHOOK_SECRET`. The backend verifies the `X-Signature` header and rejects any request that doesn't match.

**Reliability:** Failed webhook deliveries are retried 3 times with increasing delays (15s → 30s → 60s) to handle cold-start scenarios on the backend.

---

## API Endpoints

```
POST /send                          # Accept a message for async delivery
GET  /status/:providerMessageId     # Check message status (debug)
GET  /messages                      # List all in-memory messages (debug)
GET  /health                        # Health check
```

### POST /send — Request body
```json
{
  "communicationId": "uuid",
  "recipient": "user@example.com",
  "channel": "Email",
  "content": "Your personalised message here"
}
```

---

## Configuration

All behaviour is tunable via environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `5001` | Service port |
| `CRM_WEBHOOK_URL` | `http://localhost:3001/api/webhooks/channel-status` | Backend callback URL |
| `WEBHOOK_SECRET` | — | Shared HMAC secret (must match backend) |
| `FAILURE_RATE` | `10` | % of messages that fail at delivery |
| `QUEUED_TO_SENT_DELAY` | `2000` | ms before SENT fires |
| `SENT_TO_DELIVERED_DELAY` | `3000` | ms before DELIVERED/FAILED fires |
| `DELIVERED_TO_READ_DELAY` | `4000` | ms before READ fires |
| `READ_TO_CLICKED_DELAY` | `5000` | ms before CLICKED fires |
| `RETRY_DELAY_1` | `15000` | First webhook retry delay (ms) |
| `RETRY_DELAY_2` | `30000` | Second webhook retry delay (ms) |
| `RETRY_DELAY_3` | `60000` | Third webhook retry delay (ms) |

---

## Source Structure

```
channel-service/src/
├── server.ts       # Express app — /send, /status, /messages, /health endpoints
├── queue.ts        # In-memory message queue + async delivery state machine
├── webhook.ts      # HMAC-signed webhook emitter with retry logic
└── types.ts        # Shared TypeScript types
```

---

## Setup

```bash
cd channel-service
npm install
cp .env.example .env
npm run dev
```

**.env**
```
PORT=5001
CRM_WEBHOOK_URL=http://localhost:3001/api/webhooks/channel-status
WEBHOOK_SECRET=your_shared_secret
FAILURE_RATE=10
```

Runs at **http://localhost:5001**

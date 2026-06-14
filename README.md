# Xeno Growth OS: An AI-Native Mini CRM

Xeno Growth OS is an AI-first marketing CRM that helps brands proactively discover hidden revenue opportunities in their customer data and seamlessly execute targeted campaigns across WhatsApp, SMS, and Email.

## 🧠 The "AI-Native" Philosophy

Traditional CRMs require the marketer to *know what they are looking for* (e.g., "Build an audience of users who bought X but not Y in the last 30 days"). 

This product takes a different, **AI-native approach**:
Instead of a blank canvas with a complex rule-builder, Xeno Growth OS features an **Autonomous Opportunity Engine**. 
1. The AI continuously analyzes the unified customer data.
2. It proactively discovers segments with high potential revenue (e.g., "Dormant VIPs", "Discount-Sensitive Summer Shoppers").
3. It surfaces these as "Opportunities", auto-generating the recommended audience definition, preferred channel, and predicted conversion rates.

The marketer’s role shifts from *building* to *reviewing and steering*. They can tweak the AI's campaign copy using a conversational chat interface or instantly launch the campaign.

## 🏗️ Architecture & The Channel Service Loop

To properly model the lifecycle of a marketing communication, this project implements a strict two-service architecture:

1. **CRM Backend (`/backend`)**: Handles data ingestion, AI orchestration, audience building, and campaign management.
2. **Channel Stub Service (`/channel-service`)**: A completely separate Express service representing an external provider (like Twilio or Gupshup). 

### The Asynchronous Webhook Loop
When a marketer clicks "Launch Campaign", the following happens:
1. **Send API**: The CRM iterates over the audience and `POST`s the payload to the Channel Service's `/send` endpoint. The Channel Service queues the message and returns a `202 Accepted` immediately, granting the CRM a `provider_message_id`.
2. **Simulation**: The Channel Service's internal queue asynchronously simulates network latency and stochastic user behavior (delivered, read, clicked, or failed based on configured failure rates).
3. **Receipt API (Webhook)**: As events happen, the Channel Service fires a signed webhook back to the CRM (`POST /api/webhooks/channel-status`).
4. **CRM Processing**: The CRM receives the webhook, verifies the HMAC signature, updates the `communications` table, and logs the `communication_events`.

### Scale Assumptions & Tradeoffs
- **Idempotency**: Webhooks can arrive multiple times. The CRM checks `processed_webhook_events` using the `event_id` to ensure idempotent processing.
- **Out-of-Order Delivery**: Webhooks can arrive out of order (e.g., a "DELIVERED" event arrives before "SENT"). Each event contains a `sequenceNumber`. The CRM ensures that a status is only updated if the incoming `sequenceNumber` is greater than or equal to the current status sequence.
- **Volume Handling**: In a true production environment, the webhook receiver would push payloads to an SQS queue or Kafka topic for worker processing rather than processing DB transactions inline. For this scope, inline Supabase updates were chosen for simplicity.

## 🚀 Getting Started

### Prerequisites
- Node.js (v18+)
- Supabase project (for Postgres DB)
- OpenRouter API Key (for LLM orchestration)

### Running Locally

I've included a helper script to spin up all three services simultaneously (Frontend, Backend, and Channel Service):

```bash
chmod +x start-all.sh
./start-all.sh
```

- **Frontend**: http://localhost:3000
- **CRM Backend**: http://localhost:3001
- **Channel Service**: http://localhost:5001

## 📁 Repository Structure
- `/frontend`: Next.js 14 App Router, Tailwind CSS, Recharts.
- `/backend`: Express.js, Supabase JS Client, OpenAI SDK (via OpenRouter).
- `/channel-service`: Standalone Node.js service simulating message delivery queues and webhooks.

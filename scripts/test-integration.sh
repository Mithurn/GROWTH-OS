#!/bin/bash
set -e

echo "=== Testing Channel Service + CRM Integration ==="
echo ""

# Step 1: Send a test message to Channel Service
echo "1. Sending test message to Channel Service..."
RESPONSE=$(curl -s -X POST http://localhost:5001/send \
  -H "Content-Type: application/json" \
  -d '{
    "communicationId": "test-comm-123",
    "recipient": "test@example.com",
    "channel": "Email",
    "content": "This is a test message"
  }')

echo "   Response: $RESPONSE"
PROVIDER_MSG_ID=$(echo $RESPONSE | jq -r '.providerMessageId')
echo "   Provider Message ID: $PROVIDER_MSG_ID"
echo ""

# Step 2: Wait a bit for the message to process
echo "2. Waiting for message processing (15 seconds)..."
sleep 15
echo ""

# Step 3: Check Channel Service status
echo "3. Checking Channel Service message status..."
curl -s http://localhost:5001/status/$PROVIDER_MSG_ID | jq .
echo ""

# Step 4: Check all messages in Channel Service
echo "4. All Channel Service messages:"
curl -s http://localhost:5001/messages | jq '{total: .total, messages: .messages[:3]}'
echo ""

echo "=== Integration Test Complete ==="

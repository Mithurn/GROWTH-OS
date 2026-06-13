#!/bin/bash
set -e

echo "=== Testing Full Campaign Flow with Channel Service ==="
echo ""

COMPANY_ID="aa848ed4-0871-4490-b899-9dc27ed01231"
OPP_ID="8183b515-cfeb-45e1-91ef-22cb99509266" # Cross-Sell Opportunity

# Step 1: Generate campaign
echo "1. Generating campaign..."
CAMPAIGN_JSON=$(curl -s -X POST http://localhost:3001/api/campaigns/generate \
  -H "Content-Type: application/json" \
  -d "{\"opportunityId\": \"$OPP_ID\", \"companyId\": \"$COMPANY_ID\"}")

echo "   Generated campaign:"
echo "$CAMPAIGN_JSON" | jq '.data.campaign | {name, channel, objective}' || echo "   Error: $CAMPAIGN_JSON"

CAMPAIGN_DATA=$(echo "$CAMPAIGN_JSON" | jq '.data.campaign')
echo ""

# Step 2: Save campaign
echo "2. Saving campaign..."
SAVE_RESPONSE=$(curl -s -X POST http://localhost:3001/api/campaigns \
  -H "Content-Type: application/json" \
  -d "{
    \"opportunityId\": \"$OPP_ID\",
    \"companyId\": \"$COMPANY_ID\",
    \"campaign\": $CAMPAIGN_DATA
  }")

CAMPAIGN_ID=$(echo "$SAVE_RESPONSE" | jq -r '.data.id')
echo "   Campaign ID: $CAMPAIGN_ID"
echo ""

# Step 3: Approve campaign
echo "3. Approving campaign..."
curl -s -X POST "http://localhost:3001/api/campaigns/$CAMPAIGN_ID/approve" | jq '.data | {id, status}'
echo ""

# Step 4: Launch campaign
echo "4. Launching campaign..."
LAUNCH_RESPONSE=$(curl -s -X POST "http://localhost:3001/api/campaigns/$CAMPAIGN_ID/launch")
echo "$LAUNCH_RESPONSE" | jq '.data | {communications_created}'
echo ""

# Step 5: Check Channel Service messages
echo "5. Checking Channel Service messages (waiting 3 seconds)..."
sleep 3
curl -s http://localhost:5001/messages | jq '{total: .total, latest: .messages[0] | {status, channel, sequenceNumber}}'
echo ""

# Step 6: Wait for webhooks to process
echo "6. Waiting for webhook processing (15 seconds)..."
sleep 15
echo ""

# Step 7: Check campaign metrics
echo "7. Checking campaign metrics in CRM..."
curl -s "http://localhost:3001/api/campaigns/$CAMPAIGN_ID" | jq '.data | {name, status, sent: .communications_sent, delivered: .communications_delivered, read: .communications_read}'
echo ""

echo "=== Full Flow Test Complete ==="

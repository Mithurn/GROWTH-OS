# Phase 2A Testing Guide

## ✅ What Was Built

### Backend
1. **Database Tables**
   - ✅ campaigns
   - ✅ communications
   - ✅ communication_events (with sequence_number)
   - ✅ processed_webhook_events (for idempotency)

2. **Campaign Service** (`backend/src/services/campaigns.ts`)
   - ✅ generateCampaign() - AI-powered campaign generation
   - ✅ saveCampaign() - Save draft campaign
   - ✅ approveCampaign() - Approve campaign
   - ✅ launchCampaign() - Launch campaign & create QUEUED communications
   - ✅ getCampaigns() - List all campaigns with metrics
   - ✅ getCampaignById() - Get campaign details

3. **API Endpoints** (`backend/src/server.ts`)
   - ✅ POST /api/campaigns/generate
   - ✅ POST /api/campaigns
   - ✅ GET /api/campaigns
   - ✅ GET /api/campaigns/:id
   - ✅ POST /api/campaigns/:id/approve
   - ✅ POST /api/campaigns/:id/launch

### Frontend
1. **Campaign Studio Page** (`frontend/app/campaigns/page.tsx`)
   - ✅ Campaign generation from opportunity
   - ✅ Campaign editing
   - ✅ Campaign preview
   - ✅ Campaign approval
   - ✅ Campaign launch
   - ✅ Campaign list view

2. **API Integration** (`frontend/lib/api.ts`)
   - ✅ generateCampaign()
   - ✅ saveCampaign()
   - ✅ getCampaigns()
   - ✅ approveCampaign()
   - ✅ launchCampaign()

3. **Opportunities Integration**
   - ✅ "Create Campaign" button on opportunities page

---

## 🧪 Testing Steps

### Test 1: Generate Campaign from Opportunity

1. Navigate to http://localhost:3000/opportunities
2. Select any opportunity (e.g., "Recover Dormant VIP Customers")
3. Click **"Create Campaign"** button
4. You should be redirected to `/campaigns?opportunityId=xxx`
5. Click **"Generate Campaign with AI"**
6. Wait for AI to generate campaign (3-5 seconds)
7. ✅ **VERIFY**: Campaign fields populated with AI-generated content

### Test 2: Edit Campaign

1. After generation, click **"Edit"** button
2. Modify any field (e.g., change campaign name)
3. Click **"Preview"** to see formatted view
4. ✅ **VERIFY**: Changes are reflected in preview

### Test 3: Save as Draft

1. After editing, click **"Save as Draft"**
2. ✅ **VERIFY**: Campaign appears in left sidebar with "Draft" status
3. ✅ **VERIFY**: Campaign details show in main panel

### Test 4: Approve Campaign

1. Select a Draft campaign from sidebar
2. Click **"Approve Campaign"**
3. ✅ **VERIFY**: Status changes to "Approved"
4. ✅ **VERIFY**: "Launch Campaign" button appears

### Test 5: Launch Campaign (CRITICAL)

1. Select an Approved campaign
2. Click **"Launch Campaign"**
3. ✅ **VERIFY**: Success message shows communications created count
4. ✅ **VERIFY**: Campaign status changes to "Launched"

### Test 6: Verify Communications Created

Run this SQL query in Supabase:

```sql
-- Check communications created
SELECT
  c.campaign_id,
  c.status,
  COUNT(*) as total_communications
FROM communications c
GROUP BY c.campaign_id, c.status
ORDER BY c.campaign_id;

-- Check communication events
SELECT
  ce.event_type,
  ce.sequence_number,
  COUNT(*) as total_events
FROM communication_events ce
GROUP BY ce.event_type, ce.sequence_number
ORDER BY ce.sequence_number;
```

✅ **VERIFY**:
- All communications have `status = 'QUEUED'`
- All events have `event_type = 'QUEUED'` and `sequence_number = 1`
- Number of communications = opportunity audience size

---

## 🔍 Database Verification

### Check Campaign
```sql
SELECT * FROM campaigns WHERE status = 'Launched' LIMIT 1;
```

### Check Communications
```sql
SELECT
  id,
  campaign_id,
  customer_id,
  channel,
  status,
  created_at
FROM communications
WHERE campaign_id = 'YOUR_CAMPAIGN_ID'
LIMIT 5;
```

### Check Events
```sql
SELECT
  ce.id,
  ce.communication_id,
  ce.event_type,
  ce.sequence_number,
  ce.event_timestamp,
  c.status as communication_status
FROM communication_events ce
JOIN communications c ON c.id = ce.communication_id
WHERE c.campaign_id = 'YOUR_CAMPAIGN_ID'
LIMIT 5;
```

---

## ✅ Success Criteria

Phase 2A is complete when:

1. ✅ Campaign can be generated from opportunity
2. ✅ Campaign can be edited and saved as draft
3. ✅ Campaign can be approved
4. ✅ Campaign can be launched
5. ✅ Communications are created in `QUEUED` state
6. ✅ Communication events are created with `sequence_number = 1`
7. ✅ All data persists correctly in database

---

## 🛑 STOP HERE

**DO NOT proceed to Phase 2B (Channel Service) until all Phase 2A tests pass.**

Once verified, report:
- All tests passed ✅
- Number of communications created
- Campaign ID
- Any issues or errors

Then we'll move to Phase 2B: Channel Service Integration.

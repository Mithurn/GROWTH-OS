# FrontendSpec.md

## Purpose

The frontend should feel like an AI-native Growth Copilot rather than a traditional CRM dashboard.

The user should not spend time creating segments, filtering tables, or manually building campaigns.

The product should guide the marketer from:

Customer Data

→ Customer Intelligence

→ Opportunities

→ Campaign Planning

→ Campaign Execution

→ Insights

The MVP should contain only 5 primary pages.

---

# Navigation Structure

1. Onboarding
2. Customer Intelligence
3. Growth Opportunities
4. Campaign Planner
5. Campaign Intelligence

---

# Page 1: Onboarding

## Purpose

Collect company information and customer data.

This is the first interaction with the system.

---

## Components

### Company Information Form

Fields:

- Company Name
- Industry

Industry Options:

- Fashion
- Coffee
- Beauty

---

### Customer Data Upload

Upload:

customers.csv

---

### Order Data Upload

Upload:

orders.csv

---

### Processing Status

Show progress:

✓ Customers Uploaded

✓ Orders Uploaded

✓ Validation Complete

✓ Customer Metrics Generated

✓ Attributes Generated

✓ Personas Generated

✓ Opportunities Generated

CRM Ready

---

## Actions

### Upload Files

Triggers:

POST /ingest

---

### Generate Customer Intelligence

Starts ingestion pipeline.

---

## Success State

Redirect to Customer Intelligence page.

---

# Page 2: Customer Intelligence

## Purpose

Help marketers understand their customer base.

This page focuses on customer understanding, not campaign creation.

---

## Components

### KPI Cards

Show:

- Total Customers
- Total Orders
- Total Revenue
- Average Order Value

---

### Persona Overview

Examples:

Premium Loyalists

Dormant VIPs

Discount Hunters

Weekend Shoppers

Seasonal Buyers

Each card shows:

- Persona Name
- Customer Count

---

### AI Insights Panel

Examples:

68% of revenue comes from 18% of customers.

Dormant VIPs represent ₹12.4 Lakhs in recoverable revenue.

WhatsApp performs best for Premium Loyalists.

---

### Customer Search

Search by:

- Name
- Email
- Phone

---

## Actions

View Persona

View Customer Details

Navigate To Opportunities

---

# Page 3: Growth Opportunities

## Purpose

This is the primary homepage after onboarding.

The user should begin here.

Instead of creating campaigns manually, the user starts from opportunities.

---

## Components

### Opportunity Cards

Each card displays:

- Title
- Description
- Audience Size
- Potential Revenue
- Confidence Score
- Priority Score

---

### Example Opportunities

Recover Dormant VIP Customers

Promote Monsoon Collection

Cross-Sell Accessories

Prevent Churn

Reward Top Customers

---

### Opportunity Ranking

Display highest-priority opportunities first.

---

### AI Explanation

Each opportunity includes:

Why this opportunity exists.

Why it matters.

Suggested action.

---

### Custom Goal Input

Input Box:

"What would you like to achieve?"

Examples:

Increase kurta sales

Bring back dormant customers

Promote monsoon collection

---

## Actions

Plan Campaign

View Audience

Generate Opportunity

---

## API Calls

GET /opportunities

POST /generate-opportunity

---

# Page 4: Campaign Planner

## Purpose

Transform opportunities into executable campaigns.

The AI acts as a strategist.

The marketer remains in control.

---

## Components

### Campaign Goal

Display:

Opportunity Name

Business Goal

---

### Audience Panel

Show:

Audience Size

Selection Criteria

Primary Personas

---

Example:

431 Customers

Dormant VIP

Premium Loyalists

---

### Channel Recommendation

Show:

Recommended Channel

Confidence

Reasoning

---

Example:

WhatsApp

Confidence: 84%

Reason:

Highest historical engagement.

---

### Generated Message

Display AI-generated content.

Editable by user.

---

### Forecast Panel

Display:

Expected Reach

Expected Opens

Expected Clicks

Expected Orders

Expected Revenue

---

### Reasoning Panel

Explain:

Why audience was chosen.

Why channel was chosen.

Why message was generated.

---

## Actions

Edit Audience

Edit Channel

Edit Message

Approve Campaign

Launch Campaign

---

## API Calls

POST /plan-campaign

POST /launch-campaign

---

# Page 5: Campaign Intelligence

## Purpose

Track campaign performance and provide actionable insights.

---

## Components

### Campaign Overview

Show:

Campaign Name

Launch Date

Status

Channel

---

### Performance Metrics

Display:

Sent

Delivered

Opened

Clicked

Converted

Failed

---

### Revenue Metrics

Display:

Revenue Generated

Conversion Rate

ROI

---

### Funnel Visualization

Sent

↓

Delivered

↓

Opened

↓

Clicked

↓

Converted

---

### Persona Performance

Show:

Performance by Persona

Example:

Premium Loyalists

3x Better Conversion

Weekend Shoppers

2x Better Click Rate

---

### AI Insights

Examples:

Premium Loyalists responded exceptionally well.

WhatsApp outperformed Email by 27%.

Customers aged 25–35 showed strongest engagement.

Recommended next action:

Retarget users who clicked but did not purchase.

---

### Campaign Timeline

Display communication events.

Examples:

Sent

Delivered

Opened

Clicked

Converted

---

## Actions

View Campaign Details

Duplicate Campaign

Launch Follow-Up Campaign

---

## API Calls

GET /campaigns

GET /campaign/:id

GET /analytics/:id

---

# Global Components

## Navigation Sidebar

Links:

- Customer Intelligence
- Growth Opportunities
- Campaign Planner
- Campaign Intelligence

---

## AI Copilot Panel

Available globally.

Capabilities:

- Explain Personas
- Explain Opportunities
- Explain Campaign Decisions
- Answer CRM Questions

Examples:

Why is this customer a Premium Loyalist?

Why was WhatsApp selected?

Why is this opportunity ranked highest?

---

# Design Principles

1. Opportunities first, dashboards second.
2. AI recommendations must always include reasoning.
3. Human approval required before campaign launch.
4. Minimize manual segmentation.
5. Minimize complex configuration.
6. Focus on decision making, not data entry.
7. Every page should help the marketer answer:

"What should I do next?"

The frontend should feel like an AI Growth Copilot rather than a traditional CRM platform.
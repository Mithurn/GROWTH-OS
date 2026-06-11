# OpportunityEngine.md

## Purpose

The Opportunity Engine is the core intelligence layer of the CRM.

Instead of forcing marketers to manually create segments and campaigns, the system continuously analyzes customer behavior and surfaces high-impact growth opportunities.

An Opportunity represents a potential revenue-generating action that can be converted into a campaign.

Flow:

Customer Data

→ Customer Intelligence

→ Opportunity Engine

→ Opportunity

→ Campaign Planner

→ Campaign Execution

---

# Design Principles

1. Opportunities are generated using deterministic business rules, not LLMs.
2. Every opportunity must be explainable.
3. Every opportunity must have measurable business value.
4. AI is used to explain and plan opportunities, not discover them.
5. Opportunities should be ranked by expected impact.

---

# Opportunity Lifecycle

Detected

→ Reviewed

→ Planned

→ Executed

→ Archived

### Detected

Opportunity is generated automatically by the system.

### Reviewed

User opens and reviews the opportunity.

### Planned

AI campaign planner creates a campaign strategy.

### Executed

Campaign is launched.

### Archived

Campaign is completed or no longer relevant.

---

# Opportunity Structure

Each opportunity contains:

- Opportunity Type
- Title
- Description
- Audience Size
- Potential Revenue
- Confidence Score
- Priority Score
- Supporting Customer Segment
- Recommended Action

Example:

Title:

Recover Dormant VIP Customers

Audience:

431 Customers

Potential Revenue:

₹3.8 Lakhs

Confidence:

89%

Priority:

95/100

Recommended Action:

Launch win-back campaign on WhatsApp

---

# Opportunity Types

## 1. Dormant VIP Recovery

### Business Goal

Recover previously valuable customers who have stopped purchasing.

### Detection Rule

days_since_last_order > 60

AND

lifetime_spend > ₹5000

### Example

431 Customers

Potential Revenue:

₹3.8 Lakhs

### Recommended Campaign

Win-back promotion

---

## 2. Churn Risk Customers

### Business Goal

Prevent valuable customers from becoming inactive.

### Detection Rule

Historical purchase frequency is significantly higher than current purchase activity.

Example:

Customer used to purchase every 14 days.

No purchase for 45+ days.

### Recommended Campaign

Retention campaign

---

## 3. New Collection Promotion

### Business Goal

Promote newly launched products to likely buyers.

### Detection Rule

Customer frequently purchases products from the same category as the new collection.

### Example

Monsoon Collection

Target:

Customers who frequently purchase ethnic wear.

### Recommended Campaign

Product launch campaign

---

## 4. Cross-Sell Opportunity

### Business Goal

Increase basket size and average order value.

### Detection Rule

Customer purchased Product Category A

AND

Has never purchased Product Category B

### Example

Purchased:

Kurta

Never Purchased:

Dupatta

### Recommended Campaign

Cross-sell campaign

---

## 5. VIP Reward Opportunity

### Business Goal

Increase loyalty among top customers.

### Detection Rule

Top 10% customers by lifetime spend.

### Recommended Campaign

Exclusive access or loyalty reward communication.

---

## 6. Channel Optimization Opportunity

### Business Goal

Improve communication effectiveness.

### Detection Rule

Customer consistently engages more on one channel compared to others.

### Example

WhatsApp Open Rate:

75%

Email Open Rate:

18%

### Recommended Campaign

Shift future campaigns to WhatsApp.

---

## 7. Seasonal Opportunity

### Business Goal

Leverage recurring customer behavior.

### Detection Rule

Customer purchased during a previous seasonal event.

Examples:

- Diwali
- Christmas
- New Year
- End Of Season Sale

### Recommended Campaign

Seasonal re-engagement campaign.

---

# Priority Scoring

Each opportunity receives a priority score.

Priority determines ranking on the dashboard.

Priority Score Factors:

- Potential Revenue
- Audience Size
- Confidence Score

Example Formula:

Priority Score =

(Potential Revenue Weight × Revenue Score)

+

(Audience Weight × Audience Score)

+

(Confidence Weight × Confidence Score)

Final Score Range:

0–100

---

# Confidence Scoring

Confidence represents how strongly the system believes the opportunity can produce results.

Example Factors:

- Historical campaign performance
- Similar customer behavior
- Persona consistency
- Audience quality

Confidence Range:

0–100

---

# Potential Revenue Estimation

Potential revenue should be calculated using deterministic logic.

Example:

Potential Revenue =

Audience Size

× Historical Conversion Rate

× Average Order Value

LLMs should never calculate revenue estimates.

---

# AI Usage

AI is NOT responsible for discovering opportunities.

Opportunity generation remains deterministic and explainable.

AI is responsible for:

- Explaining opportunities
- Generating campaign plans
- Generating campaign content
- Generating campaign insights

Example AI Explanation:

"431 high-value customers have not purchased in over 60 days. Historically, customers in this segment respond well to WhatsApp win-back campaigns and represent an estimated ₹3.8 Lakhs in recoverable revenue."

---

# Dashboard Presentation

Opportunities should be ranked by Priority Score.

Example:

1. Recover Dormant VIP Customers
2. Promote Monsoon Collection
3. Cross-Sell Accessories
4. Prevent Customer Churn
5. Reward VIP Customers

The homepage of the CRM should primarily focus on Opportunities rather than dashboards or manual campaign creation.

---

# Success Metrics

The Opportunity Engine is successful if it helps marketers:

- Discover growth opportunities quickly
- Reduce manual segmentation effort
- Increase campaign relevance
- Improve campaign ROI
- Focus on high-impact customer segments

The Opportunity Engine is the foundation of the AI Growth Copilot and acts as the bridge between customer intelligence and campaign execution.
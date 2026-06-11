# AIWorkflow.md

## Purpose

The AI Workflow defines exactly where AI is used in the system and where deterministic business logic should be used instead.

The goal is to build an AI-native CRM without turning the entire application into a wrapper around an LLM.

AI should be responsible for reasoning, recommendations, explanations, and content generation.

Business rules, calculations, analytics, and opportunity detection should remain deterministic and explainable.

---

# AI Design Principles

1. Use AI only where intelligence adds value.
2. Do not use AI for calculations.
3. Do not use AI for analytics aggregation.
4. Do not use AI for opportunity detection.
5. All AI outputs must be structured.
6. Every AI recommendation should include reasoning.
7. Human approval is required before campaign execution.

---

# AI Responsibilities

The AI layer is responsible for:

- Persona Generation
- Campaign Planning
- Channel Recommendation
- Message Generation
- Opportunity Explanation
- Campaign Performance Summaries

---

# Non-AI Responsibilities

The following should always use deterministic logic:

- Data Cleaning
- Data Validation
- Opportunity Detection
- Revenue Calculation
- Customer Metrics
- Analytics Aggregation
- Communication Tracking
- Event Processing
- Audience Counting

---

# AI Workflow Overview

Customer Data

↓

Customer Intelligence

↓

Persona Generation

↓

Opportunity Engine

↓

Campaign Planner

↓

Human Approval

↓

Campaign Execution

↓

Analytics

↓

AI Insights

---

# AI Stage 1: Persona Generation

## Purpose

Transform customer behavior into human-readable customer personas.

---

## Inputs

Customer Metrics:

- Lifetime Spend
- Order Count
- Average Order Value
- Days Since Last Purchase

Customer Attributes:

- Favorite Category
- Purchase Frequency
- Discount Affinity
- Preferred Channel

---

## Example Input

{

"lifetime_spend": 22000,

"avg_order_value": 2800,

"favorite_category": "Kurtas",

"purchase_frequency": "Monthly",

"discount_affinity": "Low"

}

---

## Expected Output

{

"persona_name": "Premium Ethnic Wear Loyalist",

"description": "A high-value customer who regularly purchases ethnic wear products and is less sensitive to discounts."

}

---

## Database Storage

Generated personas should be stored.

Personas should not be regenerated on every request.

---

# AI Stage 2: Opportunity Explanation

## Purpose

Convert opportunity detection results into understandable business insights.

---

## Input

{

"opportunity_type": "Dormant VIP Recovery",

"audience_size": 431,

"potential_revenue": 380000

}

---

## Output

"431 high-value customers have not purchased in over 60 days. This segment represents approximately ₹3.8 Lakhs in recoverable revenue and is a strong candidate for a win-back campaign."

---

# AI Stage 3: Campaign Planner

## Purpose

Convert a business opportunity into a complete campaign strategy.

---

## Input

{

"goal": "Recover dormant VIP customers",

"opportunity": {...},

"personas": [...],

"customer_metrics": {...}

}

---

## Expected Output

{

"recommended_channel": "WhatsApp",

"reasoning": "...",

"message": "...",

"expected_outcome": "..."

}

---

## Responsibilities

The AI Campaign Planner should:

- Analyze audience characteristics
- Recommend channel
- Generate campaign content
- Explain recommendations

The planner should NOT launch campaigns.

---

# AI Stage 4: Channel Recommendation

## Purpose

Recommend the most suitable communication channel.

---

## Available Channels

- WhatsApp
- Email
- SMS

---

## Inputs

- Audience Persona
- Historical Engagement Data
- Previous Campaign Results

---

## Example Output

Recommended Channel:

WhatsApp

Reason:

Historically delivers the highest engagement for Premium Loyalists.

Confidence:

84%

---

# AI Stage 5: Message Generation

## Purpose

Generate personalized campaign content.

---

## Inputs

- Campaign Goal
- Opportunity Type
- Audience Persona
- Channel

---

## Example Output

Hi Sarah,

We've missed you.

Explore our latest collection and enjoy an exclusive ₹500 reward on your next purchase.

Shop Now →

---

## Content Requirements

Generated content should:

- Be concise
- Match campaign goal
- Match audience persona
- Be channel appropriate

---

# Human Approval Layer

Before campaign launch, the marketer must be able to edit:

- Audience
- Message
- Channel

The AI recommends.

The human approves.

---

# AI Stage 6: Campaign Insight Generation

## Purpose

Generate natural language summaries of campaign performance.

---

## Input

Campaign Metrics:

- Sent
- Delivered
- Opened
- Clicked
- Converted
- Revenue

Audience Performance

Persona Performance

---

## Example Output

"Premium Loyalists converted 3x better than average customers. WhatsApp outperformed Email by 27%, suggesting future retention campaigns should prioritize WhatsApp."

---

# Structured Output Requirement

Every AI response should return JSON.

Avoid free-form responses.

Benefits:

- Predictable
- Easier validation
- Easier frontend integration
- Easier debugging

---

# Error Handling

If AI fails:

- Do not block application flow
- Show fallback recommendations
- Log failure
- Allow manual campaign creation

---

# Future Enhancements

Potential future AI capabilities:

- Next Best Offer
- Product Recommendations
- Dynamic Incentive Selection
- Predictive Churn Scoring
- Campaign A/B Testing Suggestions

These are outside MVP scope.

---

# Success Criteria

The AI Workflow is successful if it:

- Reduces marketer effort
- Produces explainable recommendations
- Generates relevant campaign content
- Improves campaign decision making
- Maintains human control over execution

AI should act as a Growth Copilot, not an autonomous decision maker.
# IngestionPipeline.md

## Purpose

The Ingestion Pipeline transforms raw customer and order data into structured, marketing-ready customer intelligence.

Most retailers do not maintain data in a format suitable for marketing decisions.

The purpose of this pipeline is to:

- Clean incoming data
- Standardize customer records
- Generate behavioral metrics
- Generate customer attributes
- Generate personas
- Prepare data for opportunity detection

This stage represents the "Prepare" and "Understand" phases of the CRM.

---

# Pipeline Overview

Upload CSV Files

↓

Raw Data Storage

↓

Data Validation

↓

Data Cleaning

↓

Data Normalization

↓

Customer Metrics Generation

↓

Customer Attributes Generation

↓

Persona Generation

↓

Opportunity Detection

↓

Ready For Campaign Planning

---

# User Upload Flow

During onboarding, the user provides:

## Company Information

- Company Name
- Industry

Examples:

- Fashion
- Coffee
- Beauty

---

## Customer Data File

Example:

customers.csv

Contains:

- Customer ID
- Name
- Email
- Phone
- City
- Gender

---

## Order Data File

Example:

orders.csv

Contains:

- Order ID
- Customer ID
- Product Name
- Order Amount
- Purchase Date

---

# Stage 1: Raw Data Storage

Raw files should never be modified.

Store original uploaded records in:

- raw_customers
- raw_orders

Purpose:

- Traceability
- Debugging
- Reprocessing

Raw data acts as the source of truth.

---

# Stage 2: Data Validation

Validate uploaded data before processing.

---

## Customer Validation

Check:

- Required columns exist
- Customer IDs exist
- Email format is valid
- Phone numbers are valid

---

## Order Validation

Check:

- Order IDs exist
- Customer IDs exist
- Amounts are numeric
- Dates are valid

---

## Validation Output

Show onboarding progress.

Example:

✓ Customers Loaded

✓ Orders Loaded

✓ Validation Complete

---

# Stage 3: Data Cleaning

Convert inconsistent data into a standard format.

---

## Example

Input:

Women's Kurta Green

Kurta XL Blue

Cotton Kurta Medium

---

Output:

Category:

Kurta

---

## Cleaning Tasks

- Remove duplicates
- Normalize category names
- Standardize date formats
- Standardize phone formats
- Trim invalid values

---

# Stage 4: Core CRM Data Creation

Create normalized CRM tables.

Populate:

- customers
- orders
- products
- order_items

These become the operational CRM tables.

---

# Stage 5: Customer Metrics Generation

Generate behavioral metrics.

Store in:

customer_metrics

---

## Metrics

### Lifetime Spend

Total amount spent.

---

### Total Orders

Number of completed orders.

---

### Average Order Value

Total Spend ÷ Total Orders

---

### Last Order Date

Most recent purchase date.

---

### Days Since Last Order

Current Date − Last Order Date

---

### Purchase Frequency

Average time between purchases.

---

### Engagement Score

Derived behavioral score.

---

# Example

Customer:

Sarah

Metrics:

Lifetime Spend:

₹22,000

Orders:

8

Average Order Value:

₹2,750

Days Since Last Order:

21

Purchase Frequency:

Monthly

---

# Stage 6: Customer Attribute Generation

Attributes describe customer behavior.

Store in:

customer_attributes

---

## Examples

Favorite Category

Example:

Kurtas

---

Favorite Product Type

Example:

Ethnic Wear

---

Preferred Purchase Month

Example:

October

---

Discount Affinity

Values:

- High
- Medium
- Low

---

Purchase Frequency

Values:

- Weekly
- Monthly
- Quarterly

---

Preferred Channel

Values:

- WhatsApp
- Email
- SMS

---

# Example

{

"favorite_category": "Kurtas",

"discount_affinity": "Low",

"purchase_frequency": "Monthly",

"preferred_channel": "WhatsApp"

}

---

# Stage 7: Persona Generation

Use customer metrics and attributes.

Do not generate personas directly from raw orders.

---

## Input

Customer Metrics

- 

Customer Attributes

---

## Output

Examples:

- Premium Loyalist
- Dormant VIP
- Weekend Shopper
- Discount Hunter
- Frequent Buyer
- Seasonal Shopper

---

## Storage

Generated personas should be stored and reused.

Do not regenerate every time.

---

# Stage 8: Opportunity Detection

Once customer intelligence is available, run the Opportunity Engine.

Examples:

- Dormant VIP Recovery
- Churn Prevention
- Cross Sell Opportunity
- Seasonal Promotion

Generated opportunities are stored in the opportunities table.

---

# Onboarding Progress UI

The onboarding experience should clearly show progress.

Example:

✓ Customers Uploaded

✓ Orders Uploaded

✓ Data Validated

✓ Customer Metrics Generated

✓ Customer Attributes Generated

✓ Personas Generated

✓ Opportunities Generated

CRM Ready

---

# Error Handling

If validation fails:

- Stop processing
- Show clear error message
- Highlight problematic rows
- Allow re-upload

Examples:

- Missing Customer ID
- Invalid Email
- Invalid Date Format
- Missing Order Amount

---

# Performance Considerations

Processing should happen asynchronously.

Recommended Flow:

Upload

↓

Background Processing

↓

Status Updates

↓

Completion Notification

This prevents the UI from blocking on large datasets.

---

# Success Criteria

The Ingestion Pipeline is successful if:

- Raw data is preserved
- Data becomes marketing-ready
- Customer intelligence is generated automatically
- Personas are generated successfully
- Opportunities are detected automatically
- The marketer reaches a usable CRM without manual data preparation

The Ingestion Pipeline is the foundation of the entire AI Growth Copilot.
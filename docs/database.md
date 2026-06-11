For a CRM, the **database IS the product**.
If the schema is bad:
• 
segmentation becomes hard

• 
analytics become hard

• 
AI context becomes bad

• 
campaign tracking becomes messy

**Design Principle**
We're building a **marketing CRM**, not a sales CRM.
So our core entities are:

`Customer    ↓Order    ↓Persona    ↓Opportunity    ↓Campaign    ↓Communication    ↓Communication Event`
Everything revolves around the customer.
**1. customers**
This is the most important table.

`customers`ColumnTypeidUUID PKexternal_customer_idTEXTfirst_nameTEXTlast_nameTEXTemailTEXTphoneTEXTgenderTEXTcityTEXTstateTEXTsignup_dateTIMESTAMPtotal_ordersINTEGERtotal_spentNUMERICavg_order_valueNUMERIClast_order_dateTIMESTAMPcreated_atTIMESTAMP
**Why store aggregates?**
Because you'll constantly need:

`Total SpendLast PurchaseOrder Count`
If you calculate every time:

`SUM()COUNT()GROUP BY()`
the UI becomes slower.
**Indexes**

`emailphonetotal_spentlast_order_date`
**2. products**
Needed for personas and recommendations.

`products`ColumnTypeidUUID PKskuTEXTproduct_nameTEXTcategoryTEXTsubcategoryTEXTpriceNUMERIC
Examples:

`Women's KurtaMen's ShirtLatteCappuccino`
**3. orders**

`orders`ColumnTypeidUUID PKcustomer_idFKorder_dateTIMESTAMPtotal_amountNUMERICchannelTEXTcreated_atTIMESTAMP
Examples:

`StoreWebsiteApp`
**4. order_items**
Very important.
Many candidates skip this.
Bad idea.

`order_items`ColumnTypeidUUID PKorder_idFKproduct_idFKquantityINTEGERunit_priceNUMERIC
Why?
Without this table:

`Customer bought ₹5000`
With this table:

`Customer bought:KurtaDupattaHandbag`
Much better for personas.
**5. customer_personas**
This is where AI enters.

`customer_personas`ColumnTypeidUUID PKcustomer_idFKpersona_nameTEXTconfidenceFLOATreasoningJSONBgenerated_atTIMESTAMP
Example:

`{  "favorite_category": "Kurtas",  "purchase_frequency": "Monthly",  "discount_affinity": "Low"}`
Why separate table?
Because personas change.
A customer can move from:

`Active Buyer`
to

`Dormant Buyer`
later.
**6. opportunities**
One of the coolest tables.

`opportunities`ColumnTypeidUUID PKtypeTEXTtitleTEXTdescriptionTEXTestimated_revenueNUMERICaudience_sizeINTEGERconfidence_scoreFLOATstatusTEXTcreated_atTIMESTAMP
Examples:

`Dormant VIP RecoveryMonsoon PromotionCross Sell Accessories`
This powers the homepage.
**7. opportunity_customers**
Bridge table.

`opportunity_customers`ColumnTypeidUUID PKopportunity_idFKcustomer_idFK
Needed because:

`Opportunity    ↓Thousands of customers`
**8. campaigns**
The central marketing object.

`campaigns`ColumnTypeidUUID PKtitleTEXTgoalTEXTopportunity_idFKchannelTEXTmessage_templateTEXTstatusTEXTcreated_byTEXTcreated_atTIMESTAMP
Status:

`DraftApprovedSendingCompleted`
**9. campaign_audience**
Another bridge table.

`campaign_audience`ColumnTypeidUUID PKcampaign_idFKcustomer_idFK
Needed because:

`Campaign    ↓Many Customers`
**10. communications**
Most important table for assignment.

`communications`
Each row = one message.ColumnTypeidUUID PKcampaign_idFKcustomer_idFKchannelTEXTpersonalized_messageTEXTstatusTEXTsent_atTIMESTAMP
Example:

`Campaign:Dormant VIPCustomer:SarahMessage:Hi Sarah...`
**11. communication_events**
This is where you impress interviewers.

`communication_events`ColumnTypeidUUID PKcommunication_idFKevent_typeTEXTevent_timestampTIMESTAMPmetadataJSONB
Events:

`sentdeliveredopenedreadclickedfailedconverted`
Exactly matching the assignment's callback lifecycle. 
**12. agent_runs**
This powers transparency.

`agent_runs`ColumnTypeidUUID PKuser_promptTEXTgenerated_audienceJSONBselected_channelTEXTgenerated_messageTEXTreasoningTEXTcampaign_idFKcreated_atTIMESTAMP
Example:

`Prompt:Recover dormant customersReasoning:Selected WhatsApp due to 82% engagementAudience:431 customers`
**13. campaign_metrics**
Precomputed analytics.

`campaign_metrics`ColumnTypecampaign_idFKsent_countINTEGERdelivered_countINTEGERopened_countINTEGERclicked_countINTEGERconverted_countINTEGERrevenue_generatedNUMERIC
Avoid recalculating from millions of events.
**Tables I Would NOT Create**
Don't over-engineer.
Skip:

`user_rolespermissionsaudit_logscoupon_rulesloyalty_pointsjourney_builderagent_memoryvector_embeddings`
None of these help you win the assignment.
**Final Verdict**
If I were reviewing submissions:
**Weak Schema**

`customersorderscampaigns`
5/10
**Good Schema**

`customersordersorder_itemspersonascampaignscommunicationsevents`
8/10
**What we're building**

`customersproductsordersorder_itemscustomer_personasopportunitiesopportunity_customerscampaignscampaign_audiencecommunicationscommunication_eventscampaign_metricsagent_runs`
9/10+
Because every table directly maps to a visible product feature and every table has a reason to exist. That's the kind of schema you can defend confidently in an interview.should we do any better?
Yes.
But not by adding more tables.
By making **3 architectural upgrades** that make the system feel like something a founding engineer designed instead of a college project.
Most candidates fail because they think:

`Better = More Features`
Actually:

`Better = Better Data Model + Better Product Thinking`
**Upgrade 1: Replace customer_personas with customer_attributes + personas**
This is the biggest improvement.
Current design:

`Customer↓Persona`
Problem:
Personas are AI-generated opinions.
They're not raw facts.
Instead:
**customer_attributes**

`customer_attributes`
| customer_id |

| attribute_name |

| attribute_value |
Examples:

`favorite_category = Kurtaspreferred_channel = WhatsAppdiscount_affinity = Highpurchase_frequency = Monthlyavg_days_between_orders = 21customer_lifecycle = Active`
Then personas become:

`personas`
Example:

`Premium Loyalist`
generated from:

`total_spent > 10000purchase_frequency = Highdiscount_affinity = Low`
Why?
Because if interviewers ask:Why is this customer a Premium Loyalist?
You can answer.
Huge win.
**Upgrade 2: Opportunity Engine Should Be First-Class**
Currently opportunities feel like:

`AI output`
Bad.
I would make opportunities one of the most important entities.

`Customer Data↓Opportunity Engine↓Opportunity↓Campaign`
Notice:
Campaigns come AFTER opportunities.
This aligns perfectly with the product vision.
You're not a campaign builder.
You're a growth engine.
Example:

`Dormant VIP Recovery`
exists before any campaign exists.
This is how real CRM teams think.
**Upgrade 3: Communication Events Should Drive Everything**
Most people will do:

`Campaign↓Sent`
Done.
Instead:
Everything should come from events.

`Communication↓Event Stream`
Example:

`SentDeliveredOpenedClickedConverted`
Then analytics become:

`Count Events`
instead of:

`Manually update counters`
This is closer to how real systems work.
**The One Table I'd Add
customer_metrics**
This table is gold.

`customer_metrics`
| customer_id |

| lifetime_spend |

| total_orders |

| avg_order_value |

| last_order_date |

| days_since_last_order |

| predicted_churn_score |

| engagement_score |
Why?
Because every opportunity engine query will hit this table.
Without it:

`SUM()COUNT()JOIN()GROUP BY()`
everywhere.
With it:

`SELECT *FROM customer_metricsWHERE days_since_last_order > 60`
Fast.
Simple.
Clean.
**The One Table I'd Remove**
Honestly?
I'd remove:

`campaign_metrics`
for the MVP.
Because:

`communication_events`
already contain:

`openedclickedconverted`
You can compute metrics on demand.
If you later need scale:

`materialized views`
or

`aggregated tables`
can be added.
**The Schema I'd Present In The Interview**

`customersproductsordersorder_itemscustomer_metricscustomer_attributespersonasopportunitiesopportunity_customerscampaignscampaign_audiencecommunicationscommunication_eventsagent_runs`
Notice:
Only 13 tables.
Still manageable.
Still explainable.
But much more mature.
**The Biggest Improvement I'd Make To The Product**
Not technical.
Product.
Right now the flow is:

`Upload Data↓Generate Personas↓Create Campaign`
I think it should be:

`Upload Data↓Generate Customer Intelligence↓Generate Opportunities↓Review Opportunities↓AI Campaign Planner↓Human Approval↓Launch`
That one shift is what makes the product feel aligned with Xeno's current "AI decisioning" direction instead of feeling like a traditional CRM with an LLM attached.
If I were submitting this myself, this is probably the schema and product flow I'd lock in. I wouldn't add much more. The next thing I'd focus on is defining **exactly how the Opportunity Engine works** (dormant customers, churn risk, cross-sell, new collection targeting, etc.), because that's where most of the perceived intelligence of the product will come from.
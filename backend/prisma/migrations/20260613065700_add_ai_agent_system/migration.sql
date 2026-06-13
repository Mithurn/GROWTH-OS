-- CreateTable
CREATE TABLE "customers" (
    "id" TEXT NOT NULL,
    "external_customer_id" TEXT,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "gender" TEXT,
    "city" TEXT,
    "state" TEXT,
    "signup_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "companies" (
    "id" TEXT NOT NULL,
    "company_name" TEXT NOT NULL,
    "industry" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "product_name" TEXT NOT NULL,
    "category" TEXT,
    "subcategory" TEXT,
    "price" DECIMAL(10,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "order_date" TIMESTAMP(3) NOT NULL,
    "total_amount" DECIMAL(10,2) NOT NULL,
    "channel" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_items" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unit_price" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_metrics" (
    "id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "total_orders" INTEGER NOT NULL DEFAULT 0,
    "total_spent" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "avg_order_value" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "last_order_date" TIMESTAMP(3),
    "days_since_last_order" INTEGER,
    "purchase_frequency" TEXT,
    "engagement_score" DECIMAL(5,2),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customer_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_attributes" (
    "id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "favorite_category" TEXT,
    "second_favorite_category" TEXT,
    "preferred_channel" TEXT,
    "discount_affinity" TEXT,
    "avg_days_between_orders" DECIMAL(10,2),
    "dominant_price_band" TEXT,
    "category_diversity_score" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customer_attributes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "personas" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "persona_name" TEXT NOT NULL,
    "persona_description" TEXT NOT NULL,
    "confidence_score" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "personas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "opportunities" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "agent_id" TEXT,
    "opportunity_key" TEXT NOT NULL,
    "opportunity_type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "audience_size" INTEGER NOT NULL DEFAULT 0,
    "potential_revenue" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "confidence_score" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "priority_score" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "supporting_customer_segment" TEXT NOT NULL,
    "recommended_action" TEXT NOT NULL,
    "audience_definition" JSONB NOT NULL,
    "trigger_reason" TEXT NOT NULL,
    "ai_summary" TEXT NOT NULL,
    "ai_reasoning" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Detected',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "opportunities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "opportunity_customers" (
    "id" TEXT NOT NULL,
    "opportunity_id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "opportunity_customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaigns" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "agent_id" TEXT,
    "opportunity_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "objective" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "offer" TEXT,
    "message_angle" TEXT,
    "message_content" TEXT NOT NULL,
    "message_variants" JSONB,
    "expected_outcome" TEXT,
    "reasoning" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Draft',
    "performance" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "approved_at" TIMESTAMP(3),
    "launched_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "communications" (
    "id" TEXT NOT NULL,
    "campaign_id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "message_variant" TEXT,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "provider_message_id" TEXT,
    "failure_reason" TEXT,
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "converted" BOOLEAN NOT NULL DEFAULT false,
    "revenue" DECIMAL(10,2),
    "sent_at" TIMESTAMP(3),
    "delivered_at" TIMESTAMP(3),
    "read_at" TIMESTAMP(3),
    "clicked_at" TIMESTAMP(3),
    "converted_at" TIMESTAMP(3),
    "failed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "communications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "communication_events" (
    "id" TEXT NOT NULL,
    "communication_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "event_timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sequence_number" INTEGER NOT NULL,
    "provider_message_id" TEXT,
    "provider_event_id" TEXT,
    "error_message" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "communication_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "processed_webhook_events" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "communication_id" TEXT,
    "processed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "processed_webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agents" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "goal" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'discovering',
    "guardrails" JSONB NOT NULL,
    "performance" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "last_run_at" TIMESTAMP(3),

    CONSTRAINT "agents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_actions" (
    "id" TEXT NOT NULL,
    "agent_id" TEXT NOT NULL,
    "action_type" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "details" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_actions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "customers_email_key" ON "customers"("email");

-- CreateIndex
CREATE INDEX "customers_email_idx" ON "customers"("email");

-- CreateIndex
CREATE INDEX "customers_phone_idx" ON "customers"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "companies_company_name_key" ON "companies"("company_name");

-- CreateIndex
CREATE INDEX "companies_company_name_idx" ON "companies"("company_name");

-- CreateIndex
CREATE UNIQUE INDEX "products_sku_key" ON "products"("sku");

-- CreateIndex
CREATE INDEX "orders_customer_id_idx" ON "orders"("customer_id");

-- CreateIndex
CREATE INDEX "orders_order_date_idx" ON "orders"("order_date");

-- CreateIndex
CREATE INDEX "order_items_order_id_idx" ON "order_items"("order_id");

-- CreateIndex
CREATE INDEX "order_items_product_id_idx" ON "order_items"("product_id");

-- CreateIndex
CREATE UNIQUE INDEX "customer_metrics_customer_id_key" ON "customer_metrics"("customer_id");

-- CreateIndex
CREATE INDEX "customer_metrics_total_spent_idx" ON "customer_metrics"("total_spent");

-- CreateIndex
CREATE INDEX "customer_metrics_last_order_date_idx" ON "customer_metrics"("last_order_date");

-- CreateIndex
CREATE UNIQUE INDEX "customer_attributes_customer_id_key" ON "customer_attributes"("customer_id");

-- CreateIndex
CREATE INDEX "customer_attributes_favorite_category_idx" ON "customer_attributes"("favorite_category");

-- CreateIndex
CREATE INDEX "customer_attributes_preferred_channel_idx" ON "customer_attributes"("preferred_channel");

-- CreateIndex
CREATE INDEX "customer_attributes_discount_affinity_idx" ON "customer_attributes"("discount_affinity");

-- CreateIndex
CREATE INDEX "customer_attributes_dominant_price_band_idx" ON "customer_attributes"("dominant_price_band");

-- CreateIndex
CREATE UNIQUE INDEX "personas_customer_id_key" ON "personas"("customer_id");

-- CreateIndex
CREATE INDEX "personas_company_id_idx" ON "personas"("company_id");

-- CreateIndex
CREATE INDEX "personas_persona_name_idx" ON "personas"("persona_name");

-- CreateIndex
CREATE INDEX "opportunities_company_id_idx" ON "opportunities"("company_id");

-- CreateIndex
CREATE INDEX "opportunities_agent_id_idx" ON "opportunities"("agent_id");

-- CreateIndex
CREATE INDEX "opportunities_opportunity_type_idx" ON "opportunities"("opportunity_type");

-- CreateIndex
CREATE INDEX "opportunities_status_idx" ON "opportunities"("status");

-- CreateIndex
CREATE INDEX "opportunities_priority_score_idx" ON "opportunities"("priority_score");

-- CreateIndex
CREATE UNIQUE INDEX "opportunities_company_id_opportunity_key_key" ON "opportunities"("company_id", "opportunity_key");

-- CreateIndex
CREATE INDEX "opportunity_customers_opportunity_id_idx" ON "opportunity_customers"("opportunity_id");

-- CreateIndex
CREATE INDEX "opportunity_customers_customer_id_idx" ON "opportunity_customers"("customer_id");

-- CreateIndex
CREATE UNIQUE INDEX "opportunity_customers_opportunity_id_customer_id_key" ON "opportunity_customers"("opportunity_id", "customer_id");

-- CreateIndex
CREATE INDEX "campaigns_company_id_idx" ON "campaigns"("company_id");

-- CreateIndex
CREATE INDEX "campaigns_agent_id_idx" ON "campaigns"("agent_id");

-- CreateIndex
CREATE INDEX "campaigns_opportunity_id_idx" ON "campaigns"("opportunity_id");

-- CreateIndex
CREATE INDEX "campaigns_status_idx" ON "campaigns"("status");

-- CreateIndex
CREATE INDEX "campaigns_created_at_idx" ON "campaigns"("created_at");

-- CreateIndex
CREATE INDEX "communications_campaign_id_idx" ON "communications"("campaign_id");

-- CreateIndex
CREATE INDEX "communications_customer_id_idx" ON "communications"("customer_id");

-- CreateIndex
CREATE INDEX "communications_status_idx" ON "communications"("status");

-- CreateIndex
CREATE INDEX "communications_converted_idx" ON "communications"("converted");

-- CreateIndex
CREATE INDEX "communications_provider_message_id_idx" ON "communications"("provider_message_id");

-- CreateIndex
CREATE INDEX "communications_created_at_idx" ON "communications"("created_at");

-- CreateIndex
CREATE INDEX "communication_events_communication_id_idx" ON "communication_events"("communication_id");

-- CreateIndex
CREATE INDEX "communication_events_event_type_idx" ON "communication_events"("event_type");

-- CreateIndex
CREATE INDEX "communication_events_event_timestamp_idx" ON "communication_events"("event_timestamp");

-- CreateIndex
CREATE INDEX "communication_events_sequence_number_idx" ON "communication_events"("sequence_number");

-- CreateIndex
CREATE INDEX "communication_events_provider_event_id_idx" ON "communication_events"("provider_event_id");

-- CreateIndex
CREATE UNIQUE INDEX "processed_webhook_events_event_id_key" ON "processed_webhook_events"("event_id");

-- CreateIndex
CREATE INDEX "processed_webhook_events_event_id_idx" ON "processed_webhook_events"("event_id");

-- CreateIndex
CREATE INDEX "processed_webhook_events_processed_at_idx" ON "processed_webhook_events"("processed_at");

-- CreateIndex
CREATE INDEX "agents_company_id_idx" ON "agents"("company_id");

-- CreateIndex
CREATE INDEX "agents_status_idx" ON "agents"("status");

-- CreateIndex
CREATE INDEX "agents_created_at_idx" ON "agents"("created_at");

-- CreateIndex
CREATE INDEX "agent_actions_agent_id_idx" ON "agent_actions"("agent_id");

-- CreateIndex
CREATE INDEX "agent_actions_action_type_idx" ON "agent_actions"("action_type");

-- CreateIndex
CREATE INDEX "agent_actions_created_at_idx" ON "agent_actions"("created_at");

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_metrics" ADD CONSTRAINT "customer_metrics_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_attributes" ADD CONSTRAINT "customer_attributes_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "personas" ADD CONSTRAINT "personas_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "personas" ADD CONSTRAINT "personas_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunity_customers" ADD CONSTRAINT "opportunity_customers_opportunity_id_fkey" FOREIGN KEY ("opportunity_id") REFERENCES "opportunities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunity_customers" ADD CONSTRAINT "opportunity_customers_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_opportunity_id_fkey" FOREIGN KEY ("opportunity_id") REFERENCES "opportunities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "communications" ADD CONSTRAINT "communications_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "communications" ADD CONSTRAINT "communications_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "communication_events" ADD CONSTRAINT "communication_events_communication_id_fkey" FOREIGN KEY ("communication_id") REFERENCES "communications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agents" ADD CONSTRAINT "agents_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_actions" ADD CONSTRAINT "agent_actions_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

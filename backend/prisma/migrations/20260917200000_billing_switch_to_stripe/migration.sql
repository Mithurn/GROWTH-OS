-- Switching billing provider from Razorpay to Stripe before any real
-- subscriber existed (both columns were empty on every row).
ALTER TABLE "companies" RENAME COLUMN "razorpay_customer_id" TO "stripe_customer_id";
ALTER TABLE "companies" RENAME COLUMN "razorpay_subscription_id" TO "stripe_subscription_id";

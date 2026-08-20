ALTER TABLE "repairs"
ADD COLUMN "terminal_sub_disposition" TEXT;

ALTER TABLE "app_config"
ADD COLUMN "customer_tracking_copy" JSONB NOT NULL DEFAULT '{}';

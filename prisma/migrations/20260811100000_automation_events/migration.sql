CREATE TABLE "provider_events" (
  "id" UUID NOT NULL,
  "provider" TEXT NOT NULL,
  "provider_event_id" TEXT NOT NULL,
  "event_type" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "processed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "provider_events_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "provider_events_provider_provider_event_id_key" ON "provider_events"("provider", "provider_event_id");
CREATE INDEX "provider_events_provider_processed_at_idx" ON "provider_events"("provider", "processed_at");

CREATE TABLE "automation_markers" (
  "id" UUID NOT NULL,
  "replacement_order_id" UUID NOT NULL,
  "kind" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "automation_markers_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "automation_markers_replacement_order_id_kind_key" ON "automation_markers"("replacement_order_id", "kind");

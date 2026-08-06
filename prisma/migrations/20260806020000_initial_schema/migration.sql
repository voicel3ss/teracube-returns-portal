-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "DeviceType" AS ENUM ('phone', 'watch');

-- CreateEnum
CREATE TYPE "DeviceGrade" AS ENUM ('new', 'refurbished');

-- CreateEnum
CREATE TYPE "CirculationState" AS ENUM ('in_stock', 'deployed', 'in_repair', 'retired');

-- CreateEnum
CREATE TYPE "ReplacementFlow" AS ENUM ('advance', 'regular');

-- CreateEnum
CREATE TYPE "ApprovalState" AS ENUM ('auto_approved', 'pending_review', 'approved', 'rejected');

-- CreateEnum
CREATE TYPE "ReviewState" AS ENUM ('unreviewed', 'reviewed', 'needs_clarification');

-- CreateEnum
CREATE TYPE "ReplacementResolution" AS ENUM ('free_refurb', 'paid_refurb', 'upgrade', 'no_replacement', 'exception');

-- CreateEnum
CREATE TYPE "ReplacementOrderStatus" AS ENUM ('submitted', 'paid', 'awaiting_verification', 'refurb_dispatched', 'refurb_delivered', 'return_in_transit', 'return_received', 'closed', 'unidentified', 'return_discrepancy', 'fulfillment_blocked');

-- CreateEnum
CREATE TYPE "ShipmentType" AS ENUM ('inbound', 'outbound', 'internal_transfer');

-- CreateEnum
CREATE TYPE "ShipmentStatus" AS ENUM ('created', 'label_ready', 'in_transit', 'delivered', 'received', 'exception');

-- CreateEnum
CREATE TYPE "FulfillmentType" AS ENUM ('shopify_auto', 'manual');

-- CreateEnum
CREATE TYPE "RepairStatus" AS ENUM ('received', 'in_repair', 'qc_pass', 'back_to_stock', 'terminal_fail');

-- CreateEnum
CREATE TYPE "TerminalDisposition" AS ENUM ('scrap', 'parts_harvest', 'beyond_economic_repair');

-- CreateEnum
CREATE TYPE "StaffTeam" AS ENUM ('support', 'ops_lead', 'repair', 'logistics', 'admin');

-- CreateEnum
CREATE TYPE "StaffAuthProvider" AS ENUM ('google', 'email_otp');

-- CreateEnum
CREATE TYPE "FaultCategory" AS ENUM ('screen', 'charging', 'camera', 'calls_cellular', 'battery', 'buttons', 'water_damage', 'other');

-- CreateTable
CREATE TABLE "customers" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_emails" (
    "id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "normalized" TEXT NOT NULL,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_emails_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "device_models" (
    "id" UUID NOT NULL,
    "code" VARCHAR(3) NOT NULL,
    "name" TEXT NOT NULL,
    "device_type" "DeviceType" NOT NULL,
    "serial_pattern" TEXT NOT NULL,
    "specifications" JSONB,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "device_models_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "devices" (
    "serial" VARCHAR(15) NOT NULL,
    "model_id" UUID NOT NULL,
    "current_owner_id" UUID,
    "iccid" TEXT,
    "imei" TEXT,
    "grade" "DeviceGrade" NOT NULL,
    "circulation_state" "CirculationState" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "devices_pkey" PRIMARY KEY ("serial")
);

-- CreateTable
CREATE TABLE "process_types" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "flow" "ReplacementFlow" NOT NULL,
    "fee_in_cents" INTEGER NOT NULL,
    "deposit_in_cents" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "process_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "process_type_models" (
    "process_type_id" UUID NOT NULL,
    "model_id" UUID NOT NULL,

    CONSTRAINT "process_type_models_pkey" PRIMARY KEY ("process_type_id","model_id")
);

-- CreateTable
CREATE TABLE "replacement_orders" (
    "id" UUID NOT NULL,
    "order_number" SERIAL NOT NULL,
    "customer_id" UUID NOT NULL,
    "process_type_id" UUID NOT NULL,
    "returned_device_serial" VARCHAR(15),
    "outbound_device_serial" VARCHAR(15),
    "status" "ReplacementOrderStatus" NOT NULL DEFAULT 'submitted',
    "approval_state" "ApprovalState" NOT NULL DEFAULT 'auto_approved',
    "review_state" "ReviewState" NOT NULL DEFAULT 'unreviewed',
    "resolution" "ReplacementResolution",
    "customer_fault_category" "FaultCategory",
    "customer_fault_text" TEXT,
    "cs_verified_fault" TEXT,
    "free_outcome_reason" TEXT,
    "origination_ticket_id" TEXT,
    "communication_ticket_id" TEXT,
    "payment_reference" TEXT,
    "payment_last_four" VARCHAR(4),
    "amount_paid_in_cents" INTEGER NOT NULL DEFAULT 0,
    "deposit_refunded_in_cents" INTEGER NOT NULL DEFAULT 0,
    "encrypted_shipping_address" TEXT,
    "submitted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "replacement_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "repairs" (
    "id" UUID NOT NULL,
    "device_serial" VARCHAR(15) NOT NULL,
    "status" "RepairStatus" NOT NULL DEFAULT 'received',
    "resolution_category" "FaultCategory",
    "repair_team_resolution" TEXT,
    "detailed_notes" TEXT,
    "terminal_disposition" "TerminalDisposition",
    "terminal_reason" TEXT,
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "repairs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "repair_photos" (
    "id" UUID NOT NULL,
    "repair_id" UUID NOT NULL,
    "object_key" TEXT NOT NULL,
    "caption" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "repair_photos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shipments" (
    "id" UUID NOT NULL,
    "replacement_order_id" UUID,
    "type" "ShipmentType" NOT NULL,
    "status" "ShipmentStatus" NOT NULL DEFAULT 'created',
    "fulfillment_type" "FulfillmentType",
    "carrier" TEXT,
    "tracking_number" TEXT,
    "provider" TEXT,
    "provider_shipment_id" TEXT,
    "label_object_key" TEXT,
    "qr_code_object_key" TEXT,
    "cost_in_cents" INTEGER,
    "delivered_at" TIMESTAMP(3),
    "received_at" TIMESTAMP(3),
    "contents_present" BOOLEAN,
    "contents_notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shipments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shipment_units" (
    "shipment_id" UUID NOT NULL,
    "device_serial" VARCHAR(15) NOT NULL,
    "observed" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "shipment_units_pkey" PRIMARY KEY ("shipment_id","device_serial")
);

-- CreateTable
CREATE TABLE "shipment_tracking_events" (
    "id" UUID NOT NULL,
    "shipment_id" UUID NOT NULL,
    "provider_code" TEXT,
    "description" TEXT NOT NULL,
    "occurred_at" TIMESTAMP(3) NOT NULL,
    "recorded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "raw_payload" JSONB,

    CONSTRAINT "shipment_tracking_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "staff_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_identities" (
    "id" UUID NOT NULL,
    "staff_user_id" UUID NOT NULL,
    "provider" "StaffAuthProvider" NOT NULL,
    "provider_subject" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "staff_identities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team_memberships" (
    "staff_user_id" UUID NOT NULL,
    "team" "StaffTeam" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "team_memberships_pkey" PRIMARY KEY ("staff_user_id","team")
);

-- CreateTable
CREATE TABLE "staff_sessions" (
    "id" UUID NOT NULL,
    "staff_user_id" UUID NOT NULL,
    "token_hash" CHAR(64) NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "staff_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "otp_challenges" (
    "id" UUID NOT NULL,
    "normalized_email" TEXT NOT NULL,
    "code_hash" CHAR(64) NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "consumed_at" TIMESTAMP(3),
    "failed_attempts" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "otp_challenges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_access_tokens" (
    "id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "replacement_order_id" UUID NOT NULL,
    "token_hash" CHAR(64) NOT NULL,
    "parent_app_issued" BOOLEAN NOT NULL DEFAULT false,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_access_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_events" (
    "id" UUID NOT NULL,
    "actor_staff_id" UUID,
    "actor_kind" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "metadata" JSONB,
    "ip_address" TEXT,
    "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "customer_emails_normalized_idx" ON "customer_emails"("normalized");

-- CreateIndex
CREATE UNIQUE INDEX "customer_emails_customer_id_normalized_key" ON "customer_emails"("customer_id", "normalized");

-- CreateIndex
CREATE UNIQUE INDEX "device_models_code_key" ON "device_models"("code");

-- CreateIndex
CREATE INDEX "devices_model_id_circulation_state_idx" ON "devices"("model_id", "circulation_state");

-- CreateIndex
CREATE INDEX "devices_current_owner_id_idx" ON "devices"("current_owner_id");

-- CreateIndex
CREATE UNIQUE INDEX "process_types_slug_key" ON "process_types"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "replacement_orders_order_number_key" ON "replacement_orders"("order_number");

-- CreateIndex
CREATE INDEX "replacement_orders_customer_id_created_at_idx" ON "replacement_orders"("customer_id", "created_at");

-- CreateIndex
CREATE INDEX "replacement_orders_status_review_state_idx" ON "replacement_orders"("status", "review_state");

-- CreateIndex
CREATE INDEX "replacement_orders_returned_device_serial_idx" ON "replacement_orders"("returned_device_serial");

-- CreateIndex
CREATE INDEX "replacement_orders_outbound_device_serial_idx" ON "replacement_orders"("outbound_device_serial");

-- CreateIndex
CREATE INDEX "repairs_device_serial_created_at_idx" ON "repairs"("device_serial", "created_at");

-- CreateIndex
CREATE INDEX "repairs_status_idx" ON "repairs"("status");

-- CreateIndex
CREATE INDEX "shipments_replacement_order_id_type_idx" ON "shipments"("replacement_order_id", "type");

-- CreateIndex
CREATE INDEX "shipments_tracking_number_idx" ON "shipments"("tracking_number");

-- CreateIndex
CREATE INDEX "shipments_status_delivered_at_idx" ON "shipments"("status", "delivered_at");

-- CreateIndex
CREATE INDEX "shipment_tracking_events_shipment_id_occurred_at_idx" ON "shipment_tracking_events"("shipment_id", "occurred_at");

-- CreateIndex
CREATE UNIQUE INDEX "staff_users_email_key" ON "staff_users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "staff_identities_provider_provider_subject_key" ON "staff_identities"("provider", "provider_subject");

-- CreateIndex
CREATE UNIQUE INDEX "staff_sessions_token_hash_key" ON "staff_sessions"("token_hash");

-- CreateIndex
CREATE INDEX "staff_sessions_staff_user_id_expires_at_idx" ON "staff_sessions"("staff_user_id", "expires_at");

-- CreateIndex
CREATE INDEX "otp_challenges_normalized_email_expires_at_idx" ON "otp_challenges"("normalized_email", "expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "customer_access_tokens_token_hash_key" ON "customer_access_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "customer_access_tokens_customer_id_expires_at_idx" ON "customer_access_tokens"("customer_id", "expires_at");

-- CreateIndex
CREATE INDEX "customer_access_tokens_replacement_order_id_idx" ON "customer_access_tokens"("replacement_order_id");

-- CreateIndex
CREATE INDEX "audit_events_entity_type_entity_id_occurred_at_idx" ON "audit_events"("entity_type", "entity_id", "occurred_at");

-- CreateIndex
CREATE INDEX "audit_events_actor_staff_id_occurred_at_idx" ON "audit_events"("actor_staff_id", "occurred_at");

-- AddForeignKey
ALTER TABLE "customer_emails" ADD CONSTRAINT "customer_emails_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devices" ADD CONSTRAINT "devices_model_id_fkey" FOREIGN KEY ("model_id") REFERENCES "device_models"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devices" ADD CONSTRAINT "devices_current_owner_id_fkey" FOREIGN KEY ("current_owner_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "process_type_models" ADD CONSTRAINT "process_type_models_process_type_id_fkey" FOREIGN KEY ("process_type_id") REFERENCES "process_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "process_type_models" ADD CONSTRAINT "process_type_models_model_id_fkey" FOREIGN KEY ("model_id") REFERENCES "device_models"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "replacement_orders" ADD CONSTRAINT "replacement_orders_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "replacement_orders" ADD CONSTRAINT "replacement_orders_process_type_id_fkey" FOREIGN KEY ("process_type_id") REFERENCES "process_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "replacement_orders" ADD CONSTRAINT "replacement_orders_returned_device_serial_fkey" FOREIGN KEY ("returned_device_serial") REFERENCES "devices"("serial") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "replacement_orders" ADD CONSTRAINT "replacement_orders_outbound_device_serial_fkey" FOREIGN KEY ("outbound_device_serial") REFERENCES "devices"("serial") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repairs" ADD CONSTRAINT "repairs_device_serial_fkey" FOREIGN KEY ("device_serial") REFERENCES "devices"("serial") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repair_photos" ADD CONSTRAINT "repair_photos_repair_id_fkey" FOREIGN KEY ("repair_id") REFERENCES "repairs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_replacement_order_id_fkey" FOREIGN KEY ("replacement_order_id") REFERENCES "replacement_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipment_units" ADD CONSTRAINT "shipment_units_shipment_id_fkey" FOREIGN KEY ("shipment_id") REFERENCES "shipments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipment_units" ADD CONSTRAINT "shipment_units_device_serial_fkey" FOREIGN KEY ("device_serial") REFERENCES "devices"("serial") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipment_tracking_events" ADD CONSTRAINT "shipment_tracking_events_shipment_id_fkey" FOREIGN KEY ("shipment_id") REFERENCES "shipments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_identities" ADD CONSTRAINT "staff_identities_staff_user_id_fkey" FOREIGN KEY ("staff_user_id") REFERENCES "staff_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_memberships" ADD CONSTRAINT "team_memberships_staff_user_id_fkey" FOREIGN KEY ("staff_user_id") REFERENCES "staff_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_sessions" ADD CONSTRAINT "staff_sessions_staff_user_id_fkey" FOREIGN KEY ("staff_user_id") REFERENCES "staff_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_access_tokens" ADD CONSTRAINT "customer_access_tokens_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_access_tokens" ADD CONSTRAINT "customer_access_tokens_replacement_order_id_fkey" FOREIGN KEY ("replacement_order_id") REFERENCES "replacement_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_actor_staff_id_fkey" FOREIGN KEY ("actor_staff_id") REFERENCES "staff_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Domain invariants that Prisma cannot express directly.
CREATE UNIQUE INDEX "customer_emails_one_primary_per_customer"
  ON "customer_emails"("customer_id")
  WHERE "is_primary" = true;

ALTER TABLE "customer_emails"
  ADD CONSTRAINT "customer_emails_normalized_lowercase"
  CHECK ("normalized" = lower("normalized"));

ALTER TABLE "process_types"
  ADD CONSTRAINT "process_types_nonnegative_money"
  CHECK ("fee_in_cents" >= 0 AND "deposit_in_cents" >= 0);

ALTER TABLE "replacement_orders"
  ADD CONSTRAINT "replacement_orders_valid_money"
  CHECK (
    "amount_paid_in_cents" >= 0
    AND "deposit_refunded_in_cents" >= 0
    AND "deposit_refunded_in_cents" <= "amount_paid_in_cents"
  );

ALTER TABLE "otp_challenges"
  ADD CONSTRAINT "otp_challenges_valid_attempts"
  CHECK ("failed_attempts" >= 0 AND "failed_attempts" <= 5);

CREATE FUNCTION prevent_audit_event_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'audit_events are append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "audit_events_prevent_update"
  BEFORE UPDATE ON "audit_events"
  FOR EACH ROW EXECUTE FUNCTION prevent_audit_event_mutation();

CREATE TRIGGER "audit_events_prevent_delete"
  BEFORE DELETE ON "audit_events"
  FOR EACH ROW EXECUTE FUNCTION prevent_audit_event_mutation();

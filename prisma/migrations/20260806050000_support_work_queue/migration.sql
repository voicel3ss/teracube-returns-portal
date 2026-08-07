CREATE TYPE "WorkItemStatus" AS ENUM ('open', 'claimed', 'snoozed', 'completed');
CREATE TYPE "WorkItemKind" AS ENUM ('claim_verification', 'unidentified_device', 'return_discrepancy', 'fulfillment_blocked', 'deposit_refund', 'needs_clarification');

ALTER TABLE "customers" ADD COLUMN "merged_into_id" UUID;
ALTER TABLE "customers" ADD COLUMN "merged_at" TIMESTAMP(3);
ALTER TABLE "customers" ADD CONSTRAINT "customers_merged_into_id_fkey"
  FOREIGN KEY ("merged_into_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "customers_merged_into_id_idx" ON "customers"("merged_into_id");

DROP INDEX "customer_emails_customer_id_normalized_key";
CREATE INDEX "customer_emails_customer_id_normalized_idx" ON "customer_emails"("customer_id", "normalized");

CREATE TABLE "work_items" (
  "id" UUID NOT NULL,
  "replacement_order_id" UUID NOT NULL,
  "team" "StaffTeam" NOT NULL,
  "kind" "WorkItemKind" NOT NULL,
  "status" "WorkItemStatus" NOT NULL DEFAULT 'open',
  "assigned_to_staff_id" UUID,
  "snoozed_until" TIMESTAMP(3),
  "assignment_note" TEXT,
  "last_activity_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "work_items_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "work_items_replacement_order_id_kind_key" ON "work_items"("replacement_order_id", "kind");
CREATE INDEX "work_items_team_status_snoozed_until_idx" ON "work_items"("team", "status", "snoozed_until");
CREATE INDEX "work_items_assigned_to_staff_id_status_idx" ON "work_items"("assigned_to_staff_id", "status");

ALTER TABLE "work_items" ADD CONSTRAINT "work_items_replacement_order_id_fkey"
  FOREIGN KEY ("replacement_order_id") REFERENCES "replacement_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "work_items" ADD CONSTRAINT "work_items_assigned_to_staff_id_fkey"
  FOREIGN KEY ("assigned_to_staff_id") REFERENCES "staff_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "work_items" ("id", "replacement_order_id", "team", "kind", "status", "last_activity_at", "created_at", "updated_at")
SELECT gen_random_uuid(), "id", 'support',
  CASE WHEN "status" = 'unidentified' THEN 'unidentified_device'::"WorkItemKind" ELSE 'claim_verification'::"WorkItemKind" END,
  'open', COALESCE("submitted_at", "created_at"), COALESCE("submitted_at", "created_at"), CURRENT_TIMESTAMP
FROM "replacement_orders"
WHERE "review_state" <> 'reviewed'
  AND "status" IN ('awaiting_verification', 'unidentified');

CREATE TYPE "WorkItemPauseReason" AS ENUM ('customer_approval', 'admin_review');

ALTER TABLE "work_items"
ADD COLUMN "pause_reason" "WorkItemPauseReason";

UPDATE "work_items"
SET "pause_reason" = 'customer_approval',
    "snoozed_until" = NULL
WHERE "status" = 'snoozed';

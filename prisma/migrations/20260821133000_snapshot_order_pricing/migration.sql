ALTER TABLE "replacement_orders"
ADD COLUMN "quoted_fee_in_cents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "quoted_deposit_in_cents" INTEGER NOT NULL DEFAULT 0;

UPDATE "replacement_orders" AS "orders"
SET
  "quoted_fee_in_cents" = "process_types"."fee_in_cents",
  "quoted_deposit_in_cents" = "process_types"."deposit_in_cents"
FROM "process_types"
WHERE "orders"."process_type_id" = "process_types"."id";

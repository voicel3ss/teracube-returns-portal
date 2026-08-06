-- A CS-created request exists before the parent chooses a process type.
ALTER TABLE "replacement_orders"
  ALTER COLUMN "process_type_id" DROP NOT NULL;

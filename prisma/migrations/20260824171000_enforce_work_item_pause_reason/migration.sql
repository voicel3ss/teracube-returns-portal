ALTER TABLE "work_items"
ADD CONSTRAINT "work_items_pause_reason_matches_status"
CHECK (
  (
    "status" = 'snoozed'
    AND "pause_reason" IS NOT NULL
    AND "snoozed_until" IS NULL
  )
  OR
  (
    "status" <> 'snoozed'
    AND "pause_reason" IS NULL
  )
);

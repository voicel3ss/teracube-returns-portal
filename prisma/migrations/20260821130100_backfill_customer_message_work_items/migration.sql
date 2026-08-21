UPDATE "work_items" AS work
SET "kind" = 'customer_message'
FROM "replacement_orders" AS replacement
WHERE work."replacement_order_id" = replacement."id"
  AND work."kind" = 'needs_clarification'
  AND replacement."review_state" <> 'needs_clarification';

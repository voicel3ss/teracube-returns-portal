CREATE UNIQUE INDEX "replacement_orders_one_active_returned_serial_idx"
ON "replacement_orders" ("returned_device_serial")
WHERE "returned_device_serial" IS NOT NULL AND "status" <> 'closed';

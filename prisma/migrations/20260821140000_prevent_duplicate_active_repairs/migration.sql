CREATE UNIQUE INDEX "repairs_one_active_per_device"
ON "repairs" ("device_serial")
WHERE "status" IN ('received', 'in_repair', 'qc_pass');

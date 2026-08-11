CREATE TABLE "app_config" (
  "id" TEXT NOT NULL DEFAULT 'default',
  "approval_mode" TEXT NOT NULL DEFAULT 'auto',
  "deposit_refund_gate" TEXT NOT NULL DEFAULT 'return_in_transit',
  "return_reminder_days" INTEGER NOT NULL DEFAULT 4,
  "return_escalation_days" INTEGER NOT NULL DEFAULT 6,
  "stale_claim_days" INTEGER NOT NULL DEFAULT 3,
  "unidentified_escalation_days" INTEGER NOT NULL DEFAULT 2,
  "stuck_repair_days" INTEGER NOT NULL DEFAULT 3,
  "return_instructions" TEXT NOT NULL DEFAULT 'Factory-reset the device, keep your SIM card, and pack it safely.',
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "app_config_pkey" PRIMARY KEY ("id")
);

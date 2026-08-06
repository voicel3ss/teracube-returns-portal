CREATE TYPE "OtpPurpose" AS ENUM ('staff_login', 'customer_email');

ALTER TABLE "otp_challenges"
  ADD COLUMN "purpose" "OtpPurpose" NOT NULL DEFAULT 'staff_login';

DROP INDEX "otp_challenges_normalized_email_expires_at_idx";

CREATE INDEX "otp_challenges_normalized_email_purpose_expires_at_idx"
  ON "otp_challenges"("normalized_email", "purpose", "expires_at");

const REFUND_ELIGIBLE_STATUSES = new Set(["return_in_transit", "return_received"]);

export function validateClaimReview(input: {
  configuredCoverage: "warranty" | "accident";
  confirmedCoverage: "warranty" | "accident";
  feeInCents: number;
  freeOutcomeReason?: string;
}): string | null {
  if (input.configuredCoverage !== input.confirmedCoverage) {
    return "The confirmed coverage changes the price. Request clarification before changing the process.";
  }
  if (input.feeInCents === 0 && !input.freeOutcomeReason?.trim()) {
    return "An internal reason is required for every free warranty outcome.";
  }
  return null;
}

export function validateDepositRefund(input: {
  status: string;
  amountInCents: number;
  depositInCents: number;
  alreadyRefundedInCents: number;
  amountPaidInCents: number;
}): { refundableInCents: number; error: string | null } {
  const refundableInCents = Math.max(
    0,
    Math.min(input.depositInCents, input.amountPaidInCents) - input.alreadyRefundedInCents,
  );
  if (!REFUND_ELIGIBLE_STATUSES.has(input.status)) {
    return { refundableInCents, error: "The return must be in transit or received before its deposit can be refunded." };
  }
  if (!Number.isInteger(input.amountInCents) || input.amountInCents <= 0) {
    return { refundableInCents, error: "Enter a positive refund amount in cents." };
  }
  if (input.amountInCents > refundableInCents) {
    return { refundableInCents, error: "The refund cannot exceed the remaining captured deposit." };
  }
  return { refundableInCents, error: null };
}

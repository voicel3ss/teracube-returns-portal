export function validateClaimReview(input: {
  configuredCoverage: "warranty" | "accident";
  confirmedCoverage: "warranty" | "accident";
  feeInCents: number;
  freeOutcomeReason?: string;
}): string | null {
  if (input.confirmedCoverage === "accident" && input.feeInCents === 0) {
    const reason = input.freeOutcomeReason?.trim() ?? "";
    const hasProtectionPlan = reason === "Accidental-damage protection plan";
    const hasCourtesyException = reason.startsWith("Courtesy exception: ") && reason.slice("Courtesy exception: ".length).trim().length >= 3;
    if (!hasProtectionPlan && !hasCourtesyException) {
      return "Free accidental-damage claims require a protection plan or a documented courtesy exception.";
    }
  }
  const approvedFreeAccidentException = input.configuredCoverage === "warranty"
    && input.confirmedCoverage === "accident"
    && input.feeInCents === 0;
  if (input.configuredCoverage !== input.confirmedCoverage && !approvedFreeAccidentException) {
    return "The confirmed coverage changes the price. Apply the correct paid process before verification.";
  }
  return null;
}

export function validateDepositRefund(input: {
  status: string;
  inboundShipmentStatuses?: string[];
  amountInCents: number;
  depositInCents: number;
  alreadyRefundedInCents: number;
  amountPaidInCents: number;
  refundGate?: "return_in_transit" | "return_received";
}): { refundableInCents: number; error: string | null } {
  const refundableInCents = Math.max(
    0,
    Math.min(input.depositInCents, input.amountPaidInCents) - input.alreadyRefundedInCents,
  );
  const eligible = isDepositRefundEligible({
    orderStatus: input.status,
    inboundShipmentStatuses: input.inboundShipmentStatuses,
    refundGate: input.refundGate,
  });
  if (!eligible) {
    return { refundableInCents, error: input.refundGate === "return_received" ? "The return must be received before its deposit can be refunded." : "The return must be in transit or received before its deposit can be refunded." };
  }
  if (!Number.isInteger(input.amountInCents) || input.amountInCents <= 0) {
    return { refundableInCents, error: "Enter a positive refund amount in cents." };
  }
  if (input.amountInCents > refundableInCents) {
    return { refundableInCents, error: "The refund cannot exceed the remaining captured deposit." };
  }
  return { refundableInCents, error: null };
}

export function isDepositRefundEligible(input: {
  orderStatus: string;
  inboundShipmentStatuses?: string[];
  refundGate?: "return_in_transit" | "return_received";
}) {
  const shipmentStatuses = input.inboundShipmentStatuses ?? [];
  if (input.refundGate === "return_received") {
    return ["return_received", "closed"].includes(input.orderStatus) || shipmentStatuses.includes("received");
  }
  return ["return_in_transit", "return_received", "closed"].includes(input.orderStatus)
    || shipmentStatuses.some((status) => ["in_transit", "delivered", "received"].includes(status));
}

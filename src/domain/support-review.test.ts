import { describe, expect, it } from "vitest";
import { isDepositRefundEligible, validateClaimReview, validateDepositRefund } from "./support-review";

describe("support claim review", () => {
  it("blocks a coverage change without repricing or an approved free exception", () => {
    expect(validateClaimReview({ configuredCoverage: "accident", confirmedCoverage: "warranty", feeInCents: 4900 }))
      .toContain("correct paid process");
  });

  it("accepts a standard free warranty claim without a redundant internal reason", () => {
    expect(validateClaimReview({ configuredCoverage: "warranty", confirmedCoverage: "warranty", feeInCents: 0 }))
      .toBeNull();
  });

  it("accepts a paid claim with matching coverage", () => {
    expect(validateClaimReview({ configuredCoverage: "accident", confirmedCoverage: "accident", feeInCents: 4900 }))
      .toBeNull();
  });

  it("blocks free accidental damage without an approved exception", () => {
    expect(validateClaimReview({ configuredCoverage: "accident", confirmedCoverage: "accident", feeInCents: 0, freeOutcomeReason: "Looks okay" }))
      .toContain("protection plan");
  });

  it("accepts free accidental damage covered by a protection plan", () => {
    expect(validateClaimReview({ configuredCoverage: "warranty", confirmedCoverage: "accident", feeInCents: 0, freeOutcomeReason: "Accidental-damage protection plan" }))
      .toBeNull();
  });

  it("accepts a documented courtesy exception", () => {
    expect(validateClaimReview({ configuredCoverage: "warranty", confirmedCoverage: "accident", feeInCents: 0, freeOutcomeReason: "Courtesy exception: One-time retention exception" }))
      .toBeNull();
  });
});

describe("support deposit refunds", () => {
  it("only allows refunds after the return is in transit", () => {
    expect(validateDepositRefund({ status: "paid", amountInCents: 8000, depositInCents: 8000, alreadyRefundedInCents: 0, amountPaidInCents: 8000 }).error)
      .toContain("in transit");
  });

  it("prevents refunding more than the remaining deposit", () => {
    const result = validateDepositRefund({ status: "return_received", amountInCents: 6001, depositInCents: 8000, alreadyRefundedInCents: 2000, amountPaidInCents: 12900 });
    expect(result.refundableInCents).toBe(6000);
    expect(result.error).toContain("remaining captured deposit");
  });

  it("can require physical receipt before a deposit refund", () => {
    const result = validateDepositRefund({ status: "return_in_transit", amountInCents: 1000, depositInCents: 8000, alreadyRefundedInCents: 0, amountPaidInCents: 8000, refundGate: "return_received" });
    expect(result.error).toContain("must be received");
  });

  it("keeps a refund eligible after the order closes", () => {
    expect(isDepositRefundEligible({ orderStatus: "closed" })).toBe(true);
    expect(isDepositRefundEligible({ orderStatus: "closed", refundGate: "return_received" })).toBe(true);
  });

  it("uses the physical inbound leg when the aggregate order status emphasizes the replacement", () => {
    expect(isDepositRefundEligible({ orderStatus: "refurb_delivered", inboundShipmentStatuses: ["delivered"] })).toBe(true);
    expect(isDepositRefundEligible({ orderStatus: "refurb_delivered", inboundShipmentStatuses: ["delivered"], refundGate: "return_received" })).toBe(false);
  });
});

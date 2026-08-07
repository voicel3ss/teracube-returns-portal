import { describe, expect, it } from "vitest";
import { validateClaimReview, validateDepositRefund } from "./support-review";

describe("support claim review", () => {
  it("blocks a coverage change that would bypass repricing", () => {
    expect(validateClaimReview({ configuredCoverage: "warranty", confirmedCoverage: "accident", feeInCents: 0 }))
      .toContain("changes the price");
  });

  it("requires a reason for a free outcome", () => {
    expect(validateClaimReview({ configuredCoverage: "warranty", confirmedCoverage: "warranty", feeInCents: 0 }))
      .toContain("internal reason");
  });

  it("accepts a paid claim with matching coverage", () => {
    expect(validateClaimReview({ configuredCoverage: "accident", confirmedCoverage: "accident", feeInCents: 4900 }))
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
});

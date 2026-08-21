import { describe, expect, it } from "vitest";
import { outstandingBalanceInCents, quotedTotalInCents, refundableDepositInCents } from "./order-pricing";

describe("immutable order pricing", () => {
  it("calculates the balance from the order quote rather than current admin configuration", () => {
    expect(outstandingBalanceInCents({ quotedFeeInCents: 4900, quotedDepositInCents: 8000, amountPaidInCents: 8000 })).toBe(4900);
  });

  it("never returns negative financial amounts", () => {
    expect(quotedTotalInCents({ quotedFeeInCents: -1, quotedDepositInCents: -1 })).toBe(0);
    expect(outstandingBalanceInCents({ quotedFeeInCents: 0, quotedDepositInCents: 8000, amountPaidInCents: 9000 })).toBe(0);
  });

  it("caps a refund at the captured quoted deposit", () => {
    expect(refundableDepositInCents({ quotedDepositInCents: 8000, amountPaidInCents: 12900, depositRefundedInCents: 2000 })).toBe(6000);
  });
});

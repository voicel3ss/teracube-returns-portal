import { describe, expect, it } from "vitest";
import { canPayOutstandingBalance } from "./customer-payment";

describe("customer balance payment", () => {
  it("allows payment only while Support is waiting for a repriced balance", () => {
    expect(canPayOutstandingBalance({ status: "submitted", reviewState: "needs_clarification", balanceInCents: 4900 })).toBe(true);
  });

  it("does not reopen a closed or already-moving request", () => {
    expect(canPayOutstandingBalance({ status: "closed", reviewState: "reviewed", balanceInCents: 4900 })).toBe(false);
    expect(canPayOutstandingBalance({ status: "return_in_transit", reviewState: "reviewed", balanceInCents: 4900 })).toBe(false);
  });

  it("does not offer a zero-balance payment", () => {
    expect(canPayOutstandingBalance({ status: "submitted", reviewState: "needs_clarification", balanceInCents: 0 })).toBe(false);
  });
});

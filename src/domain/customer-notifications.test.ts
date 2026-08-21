import { describe, expect, it } from "vitest";
import {
  carrierUpdateMessage,
  orderSubmittedMessage,
  refundIssuedMessage,
  replacementDispatchedMessage,
  returnReceivedMessage,
} from "./customer-notifications";

describe("customer notification copy", () => {
  it("formats captured payments and refunds as dollars", () => {
    expect(orderSubmittedMessage(12900)).toContain("$129.00");
    expect(refundIssuedMessage(8000)).toContain("$80.00");
  });

  it("includes actionable carrier details and SIM guidance", () => {
    expect(replacementDispatchedMessage("USPS", "9400")).toBe(
      "Your replacement has shipped with USPS. Tracking number: 9400. Move your SIM card to the replacement when it arrives.",
    );
  });

  it("distinguishes ordinary receipt, discrepancy review, and completion", () => {
    expect(returnReceivedMessage({ discrepancy: false, closed: false })).toBe("We received your returned device.");
    expect(returnReceivedMessage({ discrepancy: true, closed: false })).toContain("reviewing");
    expect(returnReceivedMessage({ discrepancy: false, closed: true })).toContain("complete");
  });

  it("adds explicit completion copy to the final carrier event", () => {
    expect(carrierUpdateMessage({ description: "Return delivered.", closed: true })).toContain("now complete");
  });
});

import { describe, expect, it } from "vitest";
import { getCustomerTrackingView } from "./customer-tracking";

describe("customer tracking presentation", () => {
  it("uses plain-language verification copy", () => {
    const view = getCustomerTrackingView("awaiting_verification", "advance");
    expect(view.headline).toBe("We’re verifying your request");
    expect(view.detail).not.toContain("review_state");
  });

  it("explains the regular-flow tracking handoff", () => {
    const view = getCustomerTrackingView("return_in_transit", "regular");
    expect(view.replacementStatus).toBe("Preparing to ship");
  });

  it("shows both physical legs complete only when the order is closed", () => {
    expect(getCustomerTrackingView("closed", "advance")).toMatchObject({
      tone: "complete",
      returnStatus: "Received",
      replacementStatus: "Delivered",
    });
  });
});

describe("shipment-aware customer tracking", () => {
  it("shows the actual parallel leg states instead of fallback copy", () => {
    const view = getCustomerTrackingView("return_received", "regular", { inboundStatus: "received", outboundStatus: "in_transit" });
    expect(view.returnStatus).toBe("Received");
    expect(view.replacementStatus).toBe("In transit");
  });

  it("does not hide a return discrepancy behind shipment progress", () => {
    const view = getCustomerTrackingView("return_discrepancy", "advance", { inboundStatus: "received", outboundStatus: "in_transit" });
    expect(view.returnStatus).toBe("Needs review");
    expect(view.tone).toBe("attention");
  });
});

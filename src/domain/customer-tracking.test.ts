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

import { describe, expect, it } from "vitest";
import { statusAfterDiscrepancyResolution, statusAfterFulfillmentResolution } from "./support-resolution";

describe("return-discrepancy resolution", () => {
  it("continues a replacement after Support accepts the return", () => {
    expect(statusAfterDiscrepancyResolution("paid_refurb", false)).toBe("return_received");
  });

  it("closes a request when no replacement will be sent", () => {
    expect(statusAfterDiscrepancyResolution("no_replacement", false)).toBe("closed");
  });

  it("closes a completed replacement after the return is accepted", () => {
    expect(statusAfterDiscrepancyResolution("free_refurb", true)).toBe("closed");
  });
});

describe("fulfillment-block resolution", () => {
  it("resumes at the physical shipment progress already completed", () => {
    expect(statusAfterFulfillmentResolution("exception", [{ type: "inbound", status: "received" }])).toBe("return_received");
    expect(statusAfterFulfillmentResolution("upgrade", [{ type: "outbound", status: "in_transit" }])).toBe("refurb_dispatched");
  });

  it("returns to verification when fulfillment had not started", () => {
    expect(statusAfterFulfillmentResolution("exception", [])).toBe("awaiting_verification");
  });

  it("closes when Support chooses no replacement", () => {
    expect(statusAfterFulfillmentResolution("no_replacement", [])).toBe("closed");
  });
});

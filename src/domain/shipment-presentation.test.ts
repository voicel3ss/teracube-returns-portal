import { describe, expect, it } from "vitest";
import { effectiveShipmentStatus, isInboundStillExpected } from "./shipment-presentation";

describe("shipment presentation", () => {
  it("does not list a return that the order already records as received", () => {
    expect(isInboundStillExpected("return_received")).toBe(false);
    expect(effectiveShipmentStatus("inbound", "label_ready", "return_received")).toBe("received");
  });

  it("keeps returns visible while they are still physically expected", () => {
    expect(isInboundStillExpected("refurb_dispatched")).toBe(true);
    expect(effectiveShipmentStatus("inbound", "in_transit", "refurb_dispatched")).toBe("in_transit");
  });

  it("uses the order as a floor for stale outbound shipment data", () => {
    expect(effectiveShipmentStatus("outbound", "created", "refurb_dispatched")).toBe("in_transit");
    expect(effectiveShipmentStatus("outbound", "in_transit", "refurb_delivered")).toBe("delivered");
  });
});

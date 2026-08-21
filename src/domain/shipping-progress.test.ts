import { describe, expect, it } from "vitest";
import { applyCarrierProgress, orderStatusFromShipments } from "./shipping-progress";

describe("carrier progress", () => {
  it("does not move delivered or received packages backward", () => {
    expect(applyCarrierProgress("delivered", "in_transit", false)).toEqual({ status: "delivered", applied: false });
    expect(applyCarrierProgress("received", "exception", false)).toEqual({ status: "received", applied: false });
  });

  it("ignores events older than the latest recorded carrier event", () => {
    expect(applyCarrierProgress("in_transit", "delivered", true)).toEqual({ status: "in_transit", applied: false });
  });

  it("allows a newer movement event to recover an exception", () => {
    expect(applyCarrierProgress("exception", "in_transit", false)).toEqual({ status: "in_transit", applied: true });
  });
});

describe("order status from physical shipments", () => {
  it("clears a fulfillment block when the affected shipment moves again", () => {
    expect(orderStatusFromShipments({ currentStatus: "fulfillment_blocked", shipments: [{ type: "outbound", status: "in_transit" }] })).toBe("refurb_dispatched");
  });

  it("closes an order only after both physical legs finish", () => {
    expect(orderStatusFromShipments({ currentStatus: "return_received", shipments: [{ type: "inbound", status: "received" }, { type: "outbound", status: "delivered" }] })).toBe("closed");
  });

  it("keeps the customer return visible after an advance replacement was delivered", () => {
    expect(orderStatusFromShipments({
      currentStatus: "refurb_delivered",
      shipments: [
        { type: "outbound", status: "delivered" },
        { type: "inbound", status: "in_transit" },
      ],
    })).toBe("return_in_transit");
  });

  it("preserves business exceptions that require a human decision", () => {
    expect(orderStatusFromShipments({ currentStatus: "return_discrepancy", shipments: [{ type: "outbound", status: "delivered" }] })).toBe("return_discrepancy");
  });
});

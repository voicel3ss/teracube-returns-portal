import type { ReplacementResolution } from "./model";
import type { ShipmentStatus, ShipmentType } from "./model";

export function statusAfterDiscrepancyResolution(
  resolution: ReplacementResolution,
  outboundDelivered: boolean,
): "return_received" | "closed" {
  return resolution === "no_replacement" || outboundDelivered ? "closed" : "return_received";
}

export function statusAfterFulfillmentResolution(
  resolution: ReplacementResolution,
  shipments: Array<{ type: ShipmentType; status: ShipmentStatus }>,
): "awaiting_verification" | "return_in_transit" | "return_received" | "refurb_dispatched" | "refurb_delivered" | "closed" {
  if (resolution === "no_replacement") return "closed";
  const inboundReceived = shipments.some((shipment) => shipment.type === "inbound" && shipment.status === "received");
  const outboundDelivered = shipments.some((shipment) => shipment.type === "outbound" && shipment.status === "delivered");
  if (inboundReceived && outboundDelivered) return "closed";
  if (outboundDelivered) return "refurb_delivered";
  if (inboundReceived) return "return_received";
  if (shipments.some((shipment) => shipment.type === "outbound" && shipment.status === "in_transit")) return "refurb_dispatched";
  if (shipments.some((shipment) => shipment.type === "inbound" && shipment.status === "in_transit")) return "return_in_transit";
  return "awaiting_verification";
}

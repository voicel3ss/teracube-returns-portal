import type { ReplacementOrderStatus, ShipmentStatus, ShipmentType } from "./model";

const rank: Record<Exclude<ShipmentStatus, "exception">, number> = {
  created: 0,
  label_ready: 1,
  in_transit: 2,
  delivered: 3,
  received: 4,
};

export function applyCarrierProgress(current: ShipmentStatus, incoming: ShipmentStatus, stale: boolean) {
  if (stale || current === "received" || current === incoming) return { status: current, applied: false };
  if (incoming === "exception" || current === "exception") return { status: incoming, applied: true };
  return rank[incoming] > rank[current] ? { status: incoming, applied: true } : { status: current, applied: false };
}

export function orderStatusFromShipments(input: {
  currentStatus: ReplacementOrderStatus;
  shipments: Array<{ type: ShipmentType; status: ShipmentStatus }>;
}): ReplacementOrderStatus {
  if (["closed", "unidentified", "return_discrepancy"].includes(input.currentStatus)) return input.currentStatus;
  if (input.shipments.some((shipment) => shipment.status === "exception")) return "fulfillment_blocked";
  const inboundReceived = input.shipments.some((shipment) => shipment.type === "inbound" && shipment.status === "received");
  const inboundInTransit = input.shipments.some((shipment) => shipment.type === "inbound" && shipment.status === "in_transit");
  const outboundDelivered = input.shipments.some((shipment) => shipment.type === "outbound" && shipment.status === "delivered");
  if (inboundReceived && outboundDelivered) return "closed";
  if (inboundReceived) return "return_received";
  if (inboundInTransit) return "return_in_transit";
  if (outboundDelivered) return "refurb_delivered";
  if (input.shipments.some((shipment) => shipment.type === "outbound" && shipment.status === "in_transit")) return "refurb_dispatched";
  return input.currentStatus === "fulfillment_blocked" ? "awaiting_verification" : input.currentStatus;
}

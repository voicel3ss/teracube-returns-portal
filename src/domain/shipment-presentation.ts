export function isInboundStillExpected(orderStatus: string | null) {
  return orderStatus !== "return_received" && orderStatus !== "closed";
}

export function effectiveShipmentStatus(type: string, shipmentStatus: string, orderStatus: string | null) {
  if (type === "inbound" && !isInboundStillExpected(orderStatus)) return "received";
  if (type === "outbound" && (orderStatus === "refurb_delivered" || orderStatus === "closed")) return "delivered";
  if (type === "outbound" && orderStatus === "refurb_dispatched" && shipmentStatus !== "delivered") return "in_transit";
  return shipmentStatus;
}

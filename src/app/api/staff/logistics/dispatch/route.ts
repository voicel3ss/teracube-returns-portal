import { z } from "zod";
import { getAuthorizedStaff } from "@/auth/staff-request";
import { prisma } from "@/db/prisma";

const schema = z.object({ orderId: z.string().uuid(), serial: z.string().trim().length(15), fulfillmentType: z.enum(["shopify_auto", "manual"]), carrier: z.string().trim().min(1), trackingNumber: z.string().trim().min(1) });
export async function POST(request: Request) {
  const staff = await getAuthorizedStaff("shipment:dispatch");
  if (!staff) return Response.json({ error: "Logistics authorization required." }, { status: 401 });
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: "Select an order, an in-stock serial, carrier, and tracking number." }, { status: 400 });
  const order = await prisma.replacementOrder.findFirst({ where: { id: parsed.data.orderId, reviewState: "reviewed", status: { in: ["awaiting_verification", "return_in_transit", "return_received"] } } });
  if (!order) return Response.json({ error: "This order is not ready for outbound dispatch." }, { status: 409 });
  const device = await prisma.device.findFirst({ where: { serial: parsed.data.serial.toUpperCase(), circulationState: "in_stock", grade: "refurbished" } });
  if (!device) return Response.json({ error: "That serial is not available in refurbished stock." }, { status: 409 });
  const shipment = await prisma.$transaction(async (tx) => {
    const created = await tx.shipment.create({ data: { replacementOrderId: order.id, type: "outbound", status: "in_transit", fulfillmentType: parsed.data.fulfillmentType, carrier: parsed.data.carrier, trackingNumber: parsed.data.trackingNumber, provider: parsed.data.fulfillmentType === "manual" ? "manual" : "shopify", units: { create: { deviceSerial: device.serial, observed: true } }, trackingEvents: { create: { description: "Outbound replacement dispatched", occurredAt: new Date() } } } });
    await tx.device.update({ where: { serial: device.serial }, data: { circulationState: "deployed", currentOwnerId: order.customerId } });
    await tx.replacementOrder.update({ where: { id: order.id }, data: { outboundDeviceSerial: device.serial, status: "refurb_dispatched" } });
    await tx.auditEvent.create({ data: { actorStaffId: staff.id, actorKind: "staff", action: "shipment.outbound_dispatched", entityType: "shipment", entityId: created.id, metadata: { orderId: order.id, serial: device.serial, fulfillmentType: parsed.data.fulfillmentType } } });
    return created;
  });
  return Response.json({ ok: true, shipmentId: shipment.id }, { status: 201 });
}

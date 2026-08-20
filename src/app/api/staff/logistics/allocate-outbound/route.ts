import { z } from "zod";
import { getAuthorizedStaff } from "@/auth/staff-request";
import { prisma } from "@/db/prisma";

const schema = z.object({ shipmentId: z.string().uuid(), serial: z.string().trim().length(15), carrier: z.string().trim().min(1).max(80), trackingNumber: z.string().trim().min(1).max(200) });

export async function POST(request: Request) {
  const staff = await getAuthorizedStaff("shipment:dispatch");
  if (!staff) return Response.json({ error: "Logistics authorization required." }, { status: 401 });
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: "Select an available serial and enter carrier tracking." }, { status: 400 });
  const shipment = await prisma.shipment.findFirst({ where: { id: parsed.data.shipmentId, type: "outbound", status: "created" }, include: { replacementOrder: { include: { returnedDevice: true } } } });
  if (!shipment?.replacementOrder?.returnedDevice) return Response.json({ error: "This fulfillment is no longer waiting for allocation." }, { status: 409 });
  const serial = parsed.data.serial.toUpperCase();
  const device = await prisma.device.findFirst({ where: { serial, modelId: shipment.replacementOrder.returnedDevice.modelId, circulationState: "in_stock" } });
  if (!device) return Response.json({ error: "That serial is not available for the required model." }, { status: 409 });
  await prisma.$transaction([
    prisma.shipment.update({ where: { id: shipment.id }, data: { status: "in_transit", carrier: parsed.data.carrier, trackingNumber: parsed.data.trackingNumber, units: { create: { deviceSerial: device.serial, observed: true } }, trackingEvents: { create: { description: "Shopify fulfillment allocated and dispatched", occurredAt: new Date() } } } }),
    prisma.device.update({ where: { serial: device.serial }, data: { circulationState: "deployed", currentOwnerId: shipment.replacementOrder.customerId } }),
    prisma.replacementOrder.update({ where: { id: shipment.replacementOrder.id }, data: { outboundDeviceSerial: device.serial, status: "refurb_dispatched" } }),
    prisma.auditEvent.create({ data: { actorStaffId: staff.id, actorKind: "staff", action: "shipment.outbound_allocated", entityType: "shipment", entityId: shipment.id, metadata: { serial: device.serial, trackingNumber: parsed.data.trackingNumber } } }),
  ]);
  return Response.json({ ok: true });
}

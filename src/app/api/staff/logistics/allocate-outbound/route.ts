import { z } from "zod";
import { getAuthorizedStaff } from "@/auth/staff-request";
import { prisma } from "@/db/prisma";
import { isDifferentReplacementUnit } from "@/domain/replacement-unit";
import { replacementDispatchedMessage } from "@/domain/customer-notifications";

const schema = z.object({ shipmentId: z.string().uuid(), serial: z.string().trim().length(15), carrier: z.string().trim().min(1).max(80), trackingNumber: z.string().trim().min(1).max(200) });

class InventoryConflictError extends Error {}
class FulfillmentConflictError extends Error {}

export async function POST(request: Request) {
  const staff = await getAuthorizedStaff("shipment:dispatch");
  if (!staff) return Response.json({ error: "Logistics authorization required." }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Select an available serial and enter carrier tracking." }, { status: 400 });
  const shipment = await prisma.shipment.findFirst({ where: { id: parsed.data.shipmentId, type: "outbound", status: "created" }, include: { replacementOrder: { include: { returnedDevice: true } } } });
  if (!shipment?.replacementOrder?.returnedDevice) return Response.json({ error: "This fulfillment is no longer waiting for allocation." }, { status: 409 });
  const serial = parsed.data.serial.toUpperCase();
  if (!isDifferentReplacementUnit(shipment.replacementOrder.returnedDeviceSerial, serial)) return Response.json({ error: "Choose a different physical unit from the device the customer returned." }, { status: 409 });
  const device = await prisma.device.findFirst({ where: { serial, modelId: shipment.replacementOrder.returnedDevice.modelId, circulationState: "in_stock" } });
  if (!device) return Response.json({ error: "That serial is not available for the required model." }, { status: 409 });
  try {
    await prisma.$transaction(async (tx) => {
      const allocation = await tx.device.updateMany({ where: { serial: device.serial, circulationState: "in_stock" }, data: { circulationState: "deployed", currentOwnerId: shipment.replacementOrder!.customerId } });
      if (allocation.count !== 1) throw new InventoryConflictError();
      const dispatched = await tx.shipment.updateMany({ where: { id: shipment.id, status: "created", updatedAt: shipment.updatedAt }, data: { status: "in_transit", carrier: parsed.data.carrier, trackingNumber: parsed.data.trackingNumber } });
      if (dispatched.count !== 1) throw new FulfillmentConflictError();
      await tx.shipmentUnit.create({ data: { shipmentId: shipment.id, deviceSerial: device.serial, observed: true } });
      await tx.shipmentTrackingEvent.create({ data: { shipmentId: shipment.id, description: "Shopify fulfillment allocated and dispatched", occurredAt: new Date() } });
      await tx.replacementOrder.update({ where: { id: shipment.replacementOrder!.id }, data: { outboundDeviceSerial: device.serial, status: "refurb_dispatched" } });
      await tx.conversationMessage.create({
        data: {
          replacementOrderId: shipment.replacementOrder!.id,
          senderKind: "system",
          body: replacementDispatchedMessage(parsed.data.carrier, parsed.data.trackingNumber),
        },
      });
      await tx.auditEvent.create({ data: { actorStaffId: staff.id, actorKind: "staff", action: "shipment.outbound_allocated", entityType: "shipment", entityId: shipment.id, metadata: { serial: device.serial, trackingNumber: parsed.data.trackingNumber } } });
    });
  } catch (error) {
    if (error instanceof InventoryConflictError) return Response.json({ error: "Another fulfillment just allocated that serial. Refresh and choose another in-stock unit." }, { status: 409 });
    if (error instanceof FulfillmentConflictError) return Response.json({ error: "This fulfillment was completed in another session. Refresh to see its serial and tracking." }, { status: 409 });
    throw error;
  }
  return Response.json({ ok: true });
}

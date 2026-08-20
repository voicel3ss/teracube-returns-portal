import { z } from "zod";
import { getAuthorizedStaff } from "@/auth/staff-request";
import { prisma } from "@/db/prisma";
import { mockCommerceProvider } from "@/integrations/mocks/device-care";

const schema = z.object({
  orderId: z.string().uuid(), serial: z.string().trim().length(15).optional().or(z.literal("")),
  unitGrade: z.enum(["new", "refurbished"]), fulfillmentType: z.enum(["shopify_auto", "manual"]),
  carrier: z.string().trim().max(80).optional().default(""), trackingNumber: z.string().trim().max(200).optional().default(""),
}).superRefine((value, context) => {
  if (value.fulfillmentType === "manual" && (!value.serial || !value.carrier || !value.trackingNumber)) context.addIssue({ code: "custom", message: "Manual fulfillment requires an allocated serial, carrier, and tracking number." });
});

export async function POST(request: Request) {
  const staff = await getAuthorizedStaff("shipment:dispatch");
  if (!staff) return Response.json({ error: "Logistics authorization required." }, { status: 401 });
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? "Enter valid dispatch details." }, { status: 400 });
  const order = await prisma.replacementOrder.findFirst({ where: { id: parsed.data.orderId, reviewState: "reviewed", status: { in: ["awaiting_verification", "return_in_transit", "return_received"] }, shipments: { none: { type: "outbound", status: { not: "exception" } } } }, include: { processType: true, returnedDevice: true } });
  if (!order?.processType || !order.returnedDevice) return Response.json({ error: "This order is not ready for outbound dispatch." }, { status: 409 });
  const processType = order.processType;
  if (order.processType.flow === "regular" && !["return_in_transit", "return_received"].includes(order.status)) return Response.json({ error: "A regular replacement can ship only after the customer return is in transit." }, { status: 409 });

  const serial = parsed.data.serial?.toUpperCase() || null;
  const device = serial ? await prisma.device.findFirst({ where: { serial, modelId: order.returnedDevice.modelId, circulationState: "in_stock", grade: parsed.data.unitGrade } }) : null;
  if (serial && !device) return Response.json({ error: `That serial is not available as an in-stock ${parsed.data.unitGrade} unit of the required model.` }, { status: 409 });
  const providerResult = parsed.data.fulfillmentType === "shopify_auto" ? await mockCommerceProvider.dispatchReplacement({ orderId: order.id, modelId: order.returnedDevice.modelId, suppressCustomerEmail: true }) : null;
  const carrier = parsed.data.carrier || null;
  const trackingNumber = parsed.data.trackingNumber || providerResult?.trackingNumber || null;
  const status = trackingNumber ? "in_transit" as const : "created" as const;

  const shipment = await prisma.$transaction(async (tx) => {
    const created = await tx.shipment.create({ data: { replacementOrderId: order.id, type: "outbound", status, fulfillmentType: parsed.data.fulfillmentType, carrier, trackingNumber, provider: parsed.data.fulfillmentType === "manual" ? "manual" : "shopify", providerShipmentId: providerResult?.fulfillmentReference, units: device ? { create: { deviceSerial: device.serial, observed: true } } : undefined, trackingEvents: trackingNumber ? { create: { description: "Outbound replacement dispatched", occurredAt: new Date() } } : undefined } });
    if (device) await tx.device.update({ where: { serial: device.serial }, data: { circulationState: "deployed", currentOwnerId: order.customerId } });
    await tx.replacementOrder.update({ where: { id: order.id }, data: { outboundDeviceSerial: device?.serial, status: trackingNumber ? "refurb_dispatched" : order.status, resolution: order.resolution ?? (processType.feeInCents > 0 ? "paid_refurb" : "free_refurb") } });
    await tx.auditEvent.create({ data: { actorStaffId: staff.id, actorKind: "staff", action: "shipment.outbound_dispatched", entityType: "shipment", entityId: created.id, metadata: { orderId: order.id, serial: device?.serial ?? null, unitGrade: parsed.data.unitGrade, fulfillmentType: parsed.data.fulfillmentType, trackingDeferred: !trackingNumber } } });
    return created;
  });
  return Response.json({ ok: true, shipmentId: shipment.id, trackingDeferred: !trackingNumber }, { status: 201 });
}

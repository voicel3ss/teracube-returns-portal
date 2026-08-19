import { z } from "zod";
import { prisma } from "@/db/prisma";
import { verifyWebhookSignature } from "@/integrations/webhook-signature";

const schema = z.object({ id: z.string().min(1), type: z.enum(["shipment.in_transit", "shipment.delivered", "shipment.exception"]), providerShipmentId: z.string().min(1), occurredAt: z.string().datetime(), description: z.string().min(1).max(500) });

export async function POST(request: Request) {
  const body = await request.text();
  const secret = process.env.WEBHOOK_SIGNING_SECRET;
  if (!secret) return Response.json({ error: "Webhook processing is not configured." }, { status: 503 });
  if (!verifyWebhookSignature(body, request.headers.get("x-teracube-signature"), secret)) return Response.json({ error: "Invalid webhook signature." }, { status: 401 });
  let input: unknown; try { input = JSON.parse(body); } catch { return Response.json({ error: "Invalid JSON." }, { status: 400 }); }
  const parsed = schema.safeParse(input);
  if (!parsed.success) return Response.json({ error: "Invalid shipping event." }, { status: 400 });
  const duplicate = await prisma.providerEvent.findUnique({ where: { provider_providerEventId: { provider: "shipping", providerEventId: parsed.data.id } } });
  if (duplicate) return Response.json({ ok: true, duplicate: true });
  const shipment = await prisma.shipment.findFirst({ where: { providerShipmentId: parsed.data.providerShipmentId }, include: { replacementOrder: { include: { processType: true, shipments: true } } } });
  if (!shipment) return Response.json({ error: "Shipment not found." }, { status: 404 });
  const status = parsed.data.type === "shipment.in_transit" ? "in_transit" : parsed.data.type === "shipment.delivered" ? "delivered" : "exception";
  await prisma.$transaction(async (tx) => {
    await tx.providerEvent.create({ data: { provider: "shipping", providerEventId: parsed.data.id, eventType: parsed.data.type, payload: parsed.data } });
    await tx.shipment.update({ where: { id: shipment.id }, data: { status, ...(status === "delivered" ? { deliveredAt: new Date(parsed.data.occurredAt) } : {}) } });
    await tx.shipmentTrackingEvent.create({ data: { shipmentId: shipment.id, providerCode: parsed.data.type, description: parsed.data.description, occurredAt: new Date(parsed.data.occurredAt), rawPayload: parsed.data } });
    if (shipment.replacementOrderId && shipment.replacementOrder) {
      let orderStatus = shipment.replacementOrder.status;
      const protectedException = ["closed", "unidentified", "return_discrepancy", "fulfillment_blocked"].includes(orderStatus);
      if (!protectedException && status === "exception") orderStatus = "fulfillment_blocked";
      if (!protectedException && shipment.type === "inbound" && status === "in_transit") orderStatus = "return_in_transit";
      if (!protectedException && shipment.type === "outbound" && status === "in_transit") orderStatus = "refurb_dispatched";
      if (!protectedException && shipment.type === "outbound" && status === "delivered") orderStatus = "refurb_delivered";
      const inboundDone = shipment.replacementOrder.shipments.some((item) => item.type === "inbound" && item.status === "received");
      const outboundDone = shipment.type === "outbound" ? status === "delivered" : shipment.replacementOrder.shipments.some((item) => item.type === "outbound" && item.status === "delivered");
      if (!protectedException && inboundDone && outboundDone) orderStatus = "closed";
      await tx.replacementOrder.update({ where: { id: shipment.replacementOrderId }, data: { status: orderStatus } });
      if (!protectedException && status === "exception") {
        await tx.workItem.upsert({
          where: { replacementOrderId_kind: { replacementOrderId: shipment.replacementOrderId, kind: "fulfillment_blocked" } },
          update: { status: "open", assignedToStaffId: null, snoozedUntil: null, lastActivityAt: new Date(parsed.data.occurredAt) },
          create: { replacementOrderId: shipment.replacementOrderId, team: "support", kind: "fulfillment_blocked" },
        });
      }
      await tx.conversationMessage.create({ data: { replacementOrderId: shipment.replacementOrderId, senderKind: "system", body: parsed.data.description } });
    }
    await tx.auditEvent.create({ data: { actorKind: "provider", action: parsed.data.type, entityType: "shipment", entityId: shipment.id, metadata: { providerEventId: parsed.data.id, status } } });
  });
  return Response.json({ ok: true });
}

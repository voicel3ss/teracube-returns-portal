import { z } from "zod";
import { prisma } from "@/db/prisma";
import { verifyWebhookSignature } from "@/integrations/webhook-signature";
import { applyCarrierProgress, orderStatusFromShipments } from "@/domain/shipping-progress";
import { isUniqueConstraintError } from "@/db/prisma-errors";
import { carrierUpdateMessage } from "@/domain/customer-notifications";
import { isDepositRefundEligible } from "@/domain/support-review";
import { refundableDepositInCents } from "@/domain/order-pricing";

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
  const shipment = await prisma.shipment.findFirst({
    where: { providerShipmentId: parsed.data.providerShipmentId },
    include: { trackingEvents: { orderBy: { occurredAt: "desc" }, take: 1 }, replacementOrder: { include: { shipments: true } } },
  });
  if (!shipment) return Response.json({ error: "Shipment not found." }, { status: 404 });
  const config = await prisma.appConfig.upsert({ where: { id: "default" }, update: {}, create: { id: "default" } });
  const incomingStatus = parsed.data.type === "shipment.in_transit" ? "in_transit" : parsed.data.type === "shipment.delivered" ? "delivered" : "exception";
  const occurredAt = new Date(parsed.data.occurredAt);
  const progress = shipment.replacementOrder?.status === "closed"
    ? { status: shipment.status, applied: false }
    : applyCarrierProgress(shipment.status, incomingStatus, Boolean(shipment.trackingEvents[0] && occurredAt <= shipment.trackingEvents[0].occurredAt));
  try {
    await prisma.$transaction(async (tx) => {
    await tx.providerEvent.create({ data: { provider: "shipping", providerEventId: parsed.data.id, eventType: parsed.data.type, payload: parsed.data } });
    if (progress.applied) await tx.shipment.update({ where: { id: shipment.id }, data: { status: progress.status, ...(progress.status === "delivered" ? { deliveredAt: occurredAt } : {}) } });
    await tx.shipmentTrackingEvent.create({ data: { shipmentId: shipment.id, providerCode: parsed.data.type, description: parsed.data.description, occurredAt, rawPayload: parsed.data } });
    if (progress.applied && shipment.replacementOrderId && shipment.replacementOrder) {
      const shipments = shipment.replacementOrder.shipments.map((item) => item.id === shipment.id ? { ...item, status: progress.status } : item);
      const orderStatus = orderStatusFromShipments({ currentStatus: shipment.replacementOrder.status, shipments });
      await tx.replacementOrder.update({ where: { id: shipment.replacementOrderId }, data: { status: orderStatus } });
      if (refundableDepositInCents(shipment.replacementOrder) > 0 && isDepositRefundEligible({
        orderStatus,
        inboundShipmentStatuses: shipments.filter((item) => item.type === "inbound").map((item) => item.status),
        refundGate: config.depositRefundGate === "return_received" ? "return_received" : "return_in_transit",
      })) {
        await tx.workItem.upsert({
          where: { replacementOrderId_kind: { replacementOrderId: shipment.replacementOrderId, kind: "deposit_refund" } },
          update: {},
          create: { replacementOrderId: shipment.replacementOrderId, team: "support", kind: "deposit_refund" },
        });
      }
      if (orderStatus === "fulfillment_blocked") {
        await tx.workItem.upsert({
          where: { replacementOrderId_kind: { replacementOrderId: shipment.replacementOrderId, kind: "fulfillment_blocked" } },
          update: { status: "open", assignedToStaffId: null, snoozedUntil: null, lastActivityAt: occurredAt },
          create: { replacementOrderId: shipment.replacementOrderId, team: "support", kind: "fulfillment_blocked" },
        });
      } else if (shipment.replacementOrder.status === "fulfillment_blocked") {
        await tx.workItem.updateMany({ where: { replacementOrderId: shipment.replacementOrderId, kind: "fulfillment_blocked", status: { not: "completed" } }, data: { status: "completed", snoozedUntil: null, lastActivityAt: occurredAt } });
      }
      await tx.conversationMessage.create({ data: { replacementOrderId: shipment.replacementOrderId, senderKind: "system", body: carrierUpdateMessage({ description: parsed.data.description, closed: orderStatus === "closed" }) } });
    }
    await tx.auditEvent.create({ data: { actorKind: "provider", action: parsed.data.type, entityType: "shipment", entityId: shipment.id, metadata: { providerEventId: parsed.data.id, incomingStatus, status: progress.status, applied: progress.applied } } });
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) return Response.json({ ok: true, duplicate: true });
    throw error;
  }
  return Response.json({ ok: true });
}

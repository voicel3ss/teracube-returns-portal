import { timingSafeEqual } from "node:crypto";
import { prisma } from "@/db/prisma";
import { isDifferentReplacementUnit } from "@/domain/replacement-unit";
import { olderThan } from "@/automation/policy";
import { mockIdentityProvider, mockShippingProvider } from "@/integrations/mocks/device-care";
import type { IdentityProvider, ShippingProvider } from "@/integrations/contracts";
import { applyCarrierProgress, orderStatusFromShipments } from "@/domain/shipping-progress";
import { carrierUpdateMessage } from "@/domain/customer-notifications";
import { isDepositRefundEligible } from "@/domain/support-review";
import { refundableDepositInCents } from "@/domain/order-pricing";

const shippingProvider: ShippingProvider = mockShippingProvider;
const identityProvider: IdentityProvider = mockIdentityProvider;

function authorized(request: Request): boolean {
  const secret = process.env.AUTOMATION_JOB_SECRET ?? "";
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const expected = Buffer.from(secret); const received = Buffer.from(token);
  return secret.length >= 32 && expected.length === received.length && timingSafeEqual(expected, received);
}

export async function POST(request: Request) {
  if (!authorized(request)) return Response.json({ error: "Job authorization required." }, { status: 401 });
  const now = new Date();
  const config = await prisma.appConfig.upsert({ where: { id: "default" }, update: {}, create: { id: "default" } });
  let trackingPolled = 0; let trackingAdvanced = 0; let serialsBackfilled = 0;

  const trackableShipments = await prisma.shipment.findMany({
    where: { providerShipmentId: { not: null }, status: { in: ["created", "label_ready", "in_transit", "exception"] } },
    include: { replacementOrder: { include: { shipments: true } } },
  });
  for (const shipment of trackableShipments) {
    const providerShipmentId = shipment.providerShipmentId;
    if (!providerShipmentId) continue;
    const tracking = await shippingProvider.getTracking(providerShipmentId);
    trackingPolled++;
    const progress = applyCarrierProgress(shipment.status, tracking.status, false);
    if (!progress.applied) continue;
    await prisma.$transaction(async (tx) => {
      await tx.shipment.update({
        where: { id: shipment.id },
        data: { status: progress.status, deliveredAt: progress.status === "delivered" ? now : shipment.deliveredAt },
      });
      for (const event of tracking.events) {
        const exists = await tx.shipmentTrackingEvent.findFirst({ where: { shipmentId: shipment.id, occurredAt: event.occurredAt, description: event.description } });
        if (!exists) await tx.shipmentTrackingEvent.create({ data: { shipmentId: shipment.id, occurredAt: event.occurredAt, description: event.description } });
      }
      const order = shipment.replacementOrder;
      if (order) {
        const shipments = order.shipments.map((item) => item.id === shipment.id ? { ...item, status: progress.status } : item);
        const status = orderStatusFromShipments({ currentStatus: order.status, shipments });
        await tx.replacementOrder.update({ where: { id: order.id }, data: { status } });
        if (status === "fulfillment_blocked") {
          await tx.workItem.upsert({
            where: { replacementOrderId_kind: { replacementOrderId: order.id, kind: "fulfillment_blocked" } },
            update: { status: "open", assignedToStaffId: null, snoozedUntil: null, pauseReason: null, lastActivityAt: now },
            create: { replacementOrderId: order.id, team: "support", kind: "fulfillment_blocked" },
          });
        } else if (order.status === "fulfillment_blocked") {
          await tx.workItem.updateMany({ where: { replacementOrderId: order.id, kind: "fulfillment_blocked", status: { not: "completed" } }, data: { status: "completed", snoozedUntil: null, pauseReason: null, lastActivityAt: now } });
        }
        if (!["closed", "unidentified", "return_discrepancy"].includes(order.status)) {
          const description = shipment.type === "outbound"
            ? `Replacement shipment update: ${progress.status.replaceAll("_", " ")}.`
            : `Return shipment update: ${progress.status.replaceAll("_", " ")}.`;
          await tx.conversationMessage.create({
            data: {
              replacementOrderId: order.id,
              senderKind: "system",
              body: carrierUpdateMessage({ description, closed: status === "closed" }),
            },
          });
        }
      }
      await tx.auditEvent.create({ data: { actorKind: "automation", action: "shipment.tracking_polled", entityType: "shipment", entityId: shipment.id, metadata: { previousStatus: shipment.status, status: progress.status } } });
    });
    trackingAdvanced++;
  }

  const refundableOrders = await prisma.replacementOrder.findMany({
    where: { quotedDepositInCents: { gt: 0 }, paymentReference: { not: null } },
    include: { shipments: { where: { type: "inbound" }, select: { status: true } } },
  });
  let refundItemsCreated = 0;
  for (const order of refundableOrders) {
    if (refundableDepositInCents(order) <= 0 || !isDepositRefundEligible({
      orderStatus: order.status,
      inboundShipmentStatuses: order.shipments.map((shipment) => shipment.status),
      refundGate: config.depositRefundGate === "return_received" ? "return_received" : "return_in_transit",
    })) continue;
    const existing = await prisma.workItem.findUnique({ where: { replacementOrderId_kind: { replacementOrderId: order.id, kind: "deposit_refund" } }, select: { id: true } });
    await prisma.workItem.upsert({
      where: { replacementOrderId_kind: { replacementOrderId: order.id, kind: "deposit_refund" } },
      update: {},
      create: { replacementOrderId: order.id, team: "support", kind: "deposit_refund" },
    });
    if (!existing) refundItemsCreated++;
  }

  const missingOutboundSerials = await prisma.replacementOrder.findMany({
    where: { outboundDeviceSerial: null, status: { in: ["refurb_dispatched", "refurb_delivered", "return_in_transit", "return_received", "closed"] }, shipments: { some: { type: "outbound" } } },
    include: { returnedDevice: true },
  });
  for (const order of missingOutboundSerials) {
    const result = await identityProvider.backfillOutboundSerial(order.id);
    if (!result) continue;
    const serial = result.serial.trim().toUpperCase();
    const [device, alreadyUsed] = await Promise.all([
      prisma.device.findUnique({ where: { serial } }),
      prisma.replacementOrder.findFirst({ where: { outboundDeviceSerial: serial, id: { not: order.id } }, select: { id: true } }),
    ]);
    if (!device || alreadyUsed || !isDifferentReplacementUnit(order.returnedDeviceSerial, serial) || device.modelId !== order.returnedDevice?.modelId) continue;
    await prisma.$transaction([
      prisma.replacementOrder.update({ where: { id: order.id }, data: { outboundDeviceSerial: serial } }),
      prisma.device.update({ where: { serial }, data: { circulationState: "deployed", currentOwnerId: order.customerId } }),
      prisma.auditEvent.create({ data: { actorKind: "automation", action: "replacement_order.outbound_serial_backfilled", entityType: "replacement_order", entityId: order.id, metadata: { serial } } }),
    ]);
    serialsBackfilled++;
  }

  const orders = await prisma.replacementOrder.findMany({ where: { status: { not: "closed" }, submittedAt: { not: null } }, include: { shipments: true } });
  let reminders = 0; let escalations = 0;
  for (const order of orders) {
    const started = order.submittedAt ?? order.createdAt;
    const returnStarted = order.shipments.some((shipment) => shipment.type === "inbound" && ["in_transit", "delivered", "received"].includes(shipment.status));
    if (!returnStarted && olderThan(started, config.returnReminderDays, now)) {
      const exists = await prisma.automationMarker.findUnique({ where: { replacementOrderId_kind: { replacementOrderId: order.id, kind: "return_day_4_reminder" } } });
      if (!exists) { await prisma.$transaction([prisma.automationMarker.create({ data: { replacementOrderId: order.id, kind: "return_day_4_reminder" } }), prisma.conversationMessage.create({ data: { replacementOrderId: order.id, senderKind: "system", body: `Reminder: please send your original device using the Teracube return label. ${config.returnInstructions}` } }), prisma.auditEvent.create({ data: { actorKind: "automation", action: "replacement_order.return_reminder", entityType: "replacement_order", entityId: order.id, metadata: { day: config.returnReminderDays } } })]); reminders++; }
    }
    const needsEscalation = (!returnStarted && olderThan(started, config.returnEscalationDays, now)) || (order.status === "unidentified" && olderThan(order.updatedAt, config.unidentifiedEscalationDays, now));
    if (needsEscalation) {
      const kind = order.status === "unidentified" ? "unidentified_escalation" : "return_day_6_escalation";
      const exists = await prisma.automationMarker.findUnique({ where: { replacementOrderId_kind: { replacementOrderId: order.id, kind } } });
      if (!exists) { await prisma.$transaction([prisma.automationMarker.create({ data: { replacementOrderId: order.id, kind } }), prisma.auditEvent.create({ data: { actorKind: "automation", action: `replacement_order.${kind}`, entityType: "replacement_order", entityId: order.id } })]); escalations++; }
    }
  }
  const staleBefore = new Date(now.getTime() - config.staleClaimDays * 86400000);
  const staleClaims = await prisma.workItem.findMany({ where: { status: "claimed", lastActivityAt: { lte: staleBefore } } });
  for (const item of staleClaims) {
    const kind = `stale_claim_${item.id}`;
    await prisma.automationMarker.upsert({ where: { replacementOrderId_kind: { replacementOrderId: item.replacementOrderId, kind } }, update: {}, create: { replacementOrderId: item.replacementOrderId, kind } });
  }
  await prisma.auditEvent.create({ data: { actorKind: "automation", action: "automation.daily_completed", entityType: "system", entityId: now.toISOString(), metadata: { reminders, escalations, staleClaims: staleClaims.length, trackingPolled, trackingAdvanced, serialsBackfilled, refundItemsCreated } } });
  return Response.json({ ok: true, reminders, escalations, staleClaims: staleClaims.length, trackingPolled, trackingAdvanced, serialsBackfilled, refundItemsCreated });
}

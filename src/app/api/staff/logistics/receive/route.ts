import { z } from "zod";
import { getAuthorizedStaff } from "@/auth/staff-request";
import { prisma } from "@/db/prisma";
import { parseTeracubeSerial } from "@/domain/serial-number";
import { reconcileInbound } from "@/domain/shipment-reconciliation";
import { returnReceivedMessage } from "@/domain/customer-notifications";
import { isDepositRefundEligible } from "@/domain/support-review";
import { refundableDepositInCents } from "@/domain/order-pricing";

const schema = z.object({ trackingNumber: z.string().trim().min(1), contentsPresent: z.boolean(), observedSerial: z.string().trim().optional(), notes: z.string().trim().max(1000).optional() });

class ReceiptConflictError extends Error {}

export async function POST(request: Request) {
  const staff = await getAuthorizedStaff("shipment:receive");
  if (!staff) return Response.json({ error: "Logistics authorization required." }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Enter the inbound tracking number and package contents." }, { status: 400 });
  const shipment = await prisma.shipment.findFirst({ where: { trackingNumber: parsed.data.trackingNumber, type: "inbound" }, include: { replacementOrder: { include: { shipments: true } } } });
  if (!shipment) return Response.json({ error: "No inbound shipment matches that tracking number." }, { status: 404 });
  if (shipment.status === "received") return Response.json({ error: "This package was already received. Find it under Recent handoffs." }, { status: 409 });

  let observedSerial: string | null = null;
  let observedModelId: string | null = null;
  if (parsed.data.contentsPresent) {
    const models = await prisma.deviceModel.findMany({ where: { active: true } });
    const serial = parseTeracubeSerial(parsed.data.observedSerial ?? "", models);
    if (!serial.ok) return Response.json({ error: "Scan a valid device serial when a unit is present." }, { status: 400 });
    observedSerial = serial.value.serial;
    observedModelId = serial.value.modelId;
  }
  const result = reconcileInbound(shipment.replacementOrder?.returnedDeviceSerial ?? null, parsed.data.contentsPresent, observedSerial);
  const config = await prisma.appConfig.upsert({ where: { id: "default" }, update: {}, create: { id: "default" } });
  try {
    await prisma.$transaction(async (tx) => {
      const receipt = await tx.shipment.updateMany({ where: { id: shipment.id, status: { not: "received" }, updatedAt: shipment.updatedAt }, data: { status: "received", receivedAt: new Date(), contentsPresent: parsed.data.contentsPresent, contentsNotes: parsed.data.notes || null } });
      if (receipt.count !== 1) throw new ReceiptConflictError();
      if (observedSerial && observedModelId) {
        await tx.device.upsert({ where: { serial: observedSerial }, update: { circulationState: "in_repair" }, create: { serial: observedSerial, modelId: observedModelId, grade: "new", circulationState: "in_repair" } });
        await tx.shipmentUnit.upsert({ where: { shipmentId_deviceSerial: { shipmentId: shipment.id, deviceSerial: observedSerial } }, update: { observed: true }, create: { shipmentId: shipment.id, deviceSerial: observedSerial, observed: true } });
      }
      if (shipment.replacementOrderId) {
        const discrepancy = result === "mismatch" || result === "missing";
        const outboundDelivered = shipment.replacementOrder?.shipments.some((item) => item.type === "outbound" && item.status === "delivered") ?? false;
        const nextStatus = discrepancy ? "return_discrepancy" : outboundDelivered ? "closed" : "return_received";
        await tx.replacementOrder.update({ where: { id: shipment.replacementOrderId }, data: { status: nextStatus, ...(discrepancy ? { resolution: "exception" } : {}), ...(result === "unidentified" && observedSerial ? { returnedDeviceSerial: observedSerial } : {}) } });
        await tx.conversationMessage.create({
          data: {
            replacementOrderId: shipment.replacementOrderId,
            senderKind: "system",
            body: returnReceivedMessage({ discrepancy, closed: !discrepancy && outboundDelivered }),
          },
        });
        if (discrepancy) await tx.workItem.upsert({ where: { replacementOrderId_kind: { replacementOrderId: shipment.replacementOrderId, kind: "return_discrepancy" } }, update: { status: "open", assignedToStaffId: null, snoozedUntil: null, lastActivityAt: new Date() }, create: { replacementOrderId: shipment.replacementOrderId, team: "support", kind: "return_discrepancy" } });
        if (!discrepancy && shipment.replacementOrder && refundableDepositInCents(shipment.replacementOrder) > 0 && isDepositRefundEligible({
          orderStatus: nextStatus,
          inboundShipmentStatuses: ["received"],
          refundGate: config.depositRefundGate === "return_received" ? "return_received" : "return_in_transit",
        })) {
          await tx.workItem.upsert({
            where: { replacementOrderId_kind: { replacementOrderId: shipment.replacementOrderId, kind: "deposit_refund" } },
            update: {},
            create: { replacementOrderId: shipment.replacementOrderId, team: "support", kind: "deposit_refund" },
          });
        }
      }
      await tx.auditEvent.create({ data: { actorStaffId: staff.id, actorKind: "staff", action: "shipment.inbound_received", entityType: "shipment", entityId: shipment.id, metadata: { result, observedSerial, contentsPresent: parsed.data.contentsPresent } } });
    });
  } catch (error) {
    if (error instanceof ReceiptConflictError) return Response.json({ error: "This package was recorded in another session. Refresh to see the receipt." }, { status: 409 });
    throw error;
  }
  return Response.json({ ok: true, result });
}
